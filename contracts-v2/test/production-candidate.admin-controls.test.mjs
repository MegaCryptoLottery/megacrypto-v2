import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ethers } from 'ethers';
import ganache from 'ganache';
import { advance, ticketMask, winningMask } from './helpers.mjs';

const compiled = JSON.parse(
  fs.readFileSync(new URL('../artifacts/production-candidate.json', import.meta.url), 'utf8')
);
const Lottery = compiled['MegaCryptoLotteryV2ProductionCandidate.sol'].MegaCryptoLotteryV2ProductionCandidate;
const Coordinator = compiled['mocks/OfficialVrfCoordinatorMock.sol'].OfficialVrfCoordinatorMock;
const Receiver = compiled['mocks/ValidMigrationReceiver.sol'].ValidMigrationReceiver;
const Tokens = compiled['mocks/HostileTokens.sol'];

const DAY = 24 * 60 * 60;
const WEEK = 7 * DAY;
const CONFIG_DELAY = 2 * DAY;
const MIGRATION_DELAY = 7 * DAY;
const DEFAULT_PRICE_6 = 5_000_000n;

const roundConfig = (maintenanceWallet, oracleWallet, overrides = {}) => ({
  ticketPrice: DEFAULT_PRICE_6,
  roundDuration: WEEK,
  jackpotBps: 5000,
  weeklyBps: 3800,
  maintenanceBps: 600,
  oracleBps: 600,
  maintenanceWallet,
  oracleWallet,
  ...overrides
});

const addr = (value) => value.toLowerCase();
const assertAddress = (actual, expected, label = 'address') => assert.equal(addr(actual), addr(expected), label);

async function fixture({ tokenName = 'TokenBase', decimals = 6 } = {}) {
  const provider = new ethers.BrowserProvider(
    ganache.provider({
      logging: { quiet: true },
      chain: { chainId: 31337, time: new Date('2026-01-01T00:00:00Z') }
    })
  );
  provider.pollingInterval = 5;

  const owner = await provider.getSigner(0);
  const player = await provider.getSigner(1);
  const maintenance = await provider.getSigner(2);
  const oracle = await provider.getSigner(3);
  const emergency = await provider.getSigner(4);
  const attacker = await provider.getSigner(5);
  const deploy = async (artifact, args = [], signer = owner) => {
    const deployed = await new ethers.ContractFactory(
      artifact.abi,
      artifact.evm.bytecode.object,
      signer
    ).deploy(...args);
    await deployed.waitForDeployment();
    return deployed;
  };

  const token = await deploy(Tokens[tokenName], [decimals]);
  const coordinator = await deploy(Coordinator);
  const price = 5n * 10n ** BigInt(decimals);
  const initial = roundConfig(await maintenance.getAddress(), await oracle.getAddress(), {
    ticketPrice: price
  });
  const vrf = {
    coordinator: await coordinator.getAddress(),
    subscriptionId: 1n,
    keyHash: ethers.ZeroHash,
    callbackGasLimit: 500000,
    requestConfirmations: 3,
    numWords: 1,
    payWithNative: true
  };
  const lottery = await deploy(Lottery, [
    await token.getAddress(),
    decimals,
    initial,
    0,
    vrf,
    await emergency.getAddress()
  ]);

  await (await token.mint(await player.getAddress(), 1_000_000n * 10n ** BigInt(decimals))).wait();
  await (await token.connect(player).approve(await lottery.getAddress(), ethers.MaxUint256)).wait();

  return {
    provider,
    owner,
    player,
    maintenance,
    oracle,
    emergency,
    attacker,
    token,
    coordinator,
    lottery,
    deploy,
    decimals,
    price
  };
}

async function accounting(x) {
  const id = await x.lottery.currentRoundId();
  const round = await x.lottery.rounds(id);
  return {
    id,
    balance: await x.token.balanceOf(await x.lottery.getAddress()),
    playerLiabilities: await x.lottery.playerLiabilities(),
    jackpotReserve: await x.lottery.jackpotReserve(),
    activeWeeklyPool: round.weeklyPool,
    unallocatedDustReserve: await x.lottery.unallocatedDustReserve(),
    ticketIndex: await x.lottery.nextTicketIndex(),
    ticketCount: round.ticketCount,
    maintenanceBalance: await x.token.balanceOf(await x.maintenance.getAddress()),
    oracleBalance: await x.token.balanceOf(await x.oracle.getAddress())
  };
}

async function assertAccounting(x, label = 'accounting') {
  const values = await accounting(x);
  assert.equal(
    values.balance,
    values.playerLiabilities + values.jackpotReserve + values.activeWeeklyPool + values.unallocatedDustReserve,
    `${label}: lottery balance must independently reconcile`
  );
  const solvency = await x.lottery.solvency();
  assert.equal(solvency[2], true, `${label}: contract must remain solvent`);
  return values;
}

async function atomicPurchaseFailure(x, label) {
  const before = await accounting(x);
  await assert.rejects(async () => {
    const tx = await x.lottery.connect(x.player).buyTicket(ticketMask());
    await tx.wait();
  }, label);
  assert.deepEqual(await accounting(x), before, `${label}: rejected purchase must be atomic`);
}

async function activateRoundConfig(x, next) {
  const proposalReceipt = await (await x.lottery.proposeFutureRoundConfig(next)).wait();
  await assert.rejects(async () => {
    const tx = await x.lottery.activateFutureRoundConfig();
    await tx.wait();
  }, 'future config must observe its timelock');
  await advance(x.provider, CONFIG_DELAY + 1);
  // Ganache can mis-estimate this successful post-timelock storage write.
  // The explicit local-only ceiling prevents the provider estimator from
  // obscuring the candidate behavior under test.
  const activationReceipt = await (await x.lottery.activateFutureRoundConfig({ gasLimit: 500_000n })).wait();
  return { proposalReceipt, activationReceipt };
}

function eventFrom(receipt, contract, eventName) {
  for (const log of receipt.logs) {
    try {
      const decoded = contract.interface.parseLog(log);
      if (decoded?.name === eventName) return decoded.args;
    } catch {
      // The receipt also contains external token/coordinator logs.
    }
  }
  assert.fail(`missing ${eventName} event`);
}

async function settleCurrentRound(x, word) {
  const id = await x.lottery.currentRoundId();
  const before = await x.lottery.rounds(id);
  await advance(x.provider, Number(before.duration) + 1);
  await (await x.lottery.closeRound(id)).wait();
  await (await x.lottery.requestRandomness(id)).wait();
  const requested = await x.lottery.rounds(id);
  const requestId = requested.requestId;
  await (await x.coordinator.fulfill(requestId, word)).wait();
  const ready = await x.lottery.rounds(id);
  await (await x.lottery.processSettlement(id, Number(ready.ticketCount))).wait();
  const round = await x.lottery.rounds(id);
  assert.equal(round.state, 5n, `round ${id} must settle`);
  return { id, requestId, round };
}

async function openNext(x) {
  await (await x.lottery.openNextRound()).wait();
  return x.lottery.rounds(await x.lottery.currentRoundId());
}

function aNonWinningMask(word) {
  const first = ticketMask();
  if (first !== winningMask(word)) return first;
  const second = ticketMask(Array.from({ length: 15 }, (_, index) => index + 11));
  assert.notEqual(second, winningMask(word), 'test fixture requires a non-exact ticket');
  return second;
}

describe('post-admin-controls production candidate', function () {
  this.timeout(120000);

  it('deploys the exact 50/38/6/6 default snapshot and pays operational fees immediately', async () => {
    const x = await fixture();
    const active = await x.lottery.activeRoundConfig();
    const round = await x.lottery.rounds(1);

    assert.equal(await x.lottery.CANDIDATE_VERSION(), 'POST_ADMIN_CONTROLS_V1');
    assert.equal(active.ticketPrice, DEFAULT_PRICE_6);
    assert.equal(active.roundDuration, BigInt(WEEK));
    assert.equal(active.jackpotBps, 5000n);
    assert.equal(active.weeklyBps, 3800n);
    assert.equal(active.maintenanceBps, 600n);
    assert.equal(active.oracleBps, 600n);
    assert.equal(active.jackpotBps + active.weeklyBps + active.maintenanceBps + active.oracleBps, 10000n);
    assertAddress(round.maintenanceWallet, await x.maintenance.getAddress());
    assertAddress(round.oracleWallet, await x.oracle.getAddress());
    assertAddress(await x.lottery.maintenanceWallet(), await x.maintenance.getAddress());
    assertAddress(await x.lottery.oracleWallet(), await x.oracle.getAddress());

    await (await x.lottery.connect(x.player).buyTicket(ticketMask())).wait();
    const purchased = await x.lottery.rounds(1);
    assert.equal(await x.token.balanceOf(await x.maintenance.getAddress()), 300_000n);
    assert.equal(await x.token.balanceOf(await x.oracle.getAddress()), 300_000n);
    assert.equal(await x.token.balanceOf(await x.lottery.getAddress()), 4_400_000n);
    assert.equal(purchased.jackpotContribution, 2_500_000n);
    assert.equal(purchased.weeklyPool, 1_900_000n);
    assert.equal(await x.lottery.unallocatedDustReserve(), 0n);
    await assertAccounting(x, 'default 50/38/6/6 purchase');
  });

  it('uses the same BPS accounting at 18 token decimals', async () => {
    const x = await fixture({ decimals: 18 });
    const unit = 10n ** 18n;

    await (await x.lottery.connect(x.player).buyTicket(ticketMask())).wait();
    const round = await x.lottery.rounds(1);
    assert.equal(await x.token.balanceOf(await x.maintenance.getAddress()), 3n * 10n ** 17n);
    assert.equal(await x.token.balanceOf(await x.oracle.getAddress()), 3n * 10n ** 17n);
    assert.equal(round.jackpotContribution, 25n * 10n ** 17n);
    assert.equal(round.weeklyPool, 19n * 10n ** 17n);
    assert.equal(round.ticketPrice, 5n * unit);
    await assertAccounting(x, '18-decimal default purchase');
  });

  it('snapshots 50/38/6/6, 60/30/5/5, and 40/40/10/10 economics by round without retroactive changes', async () => {
    const x = await fixture();
    const owner = await x.owner.getAddress();
    const emergency = await x.emergency.getAddress();
    const attacker = await x.attacker.getAddress();
    const profile60 = roundConfig(owner, owner, {
      jackpotBps: 6000,
      weeklyBps: 3000,
      maintenanceBps: 500,
      oracleBps: 500
    });
    const profile40 = roundConfig(emergency, attacker, {
      ticketPrice: 5_000_001n,
      roundDuration: DAY,
      jackpotBps: 4000,
      weeklyBps: 4000,
      maintenanceBps: 1000,
      oracleBps: 1000
    });

    // Round 1 remains on the constructor snapshot even though the next config is activated.
    const roundOneMask = aNonWinningMask(101n);
    await (await x.lottery.connect(x.player).buyTicket(roundOneMask)).wait();
    const profile60Activation = await activateRoundConfig(x, profile60);
    const profile60Proposal = eventFrom(profile60Activation.proposalReceipt, x.lottery, 'FutureRoundConfigProposed');
    const profile60Change = eventFrom(profile60Activation.activationReceipt, x.lottery, 'FutureRoundConfigActivated');
    assert.equal(profile60Proposal.ticketPrice, DEFAULT_PRICE_6);
    assert.equal(profile60Proposal.jackpotBps, 6000n);
    assert.equal(profile60Proposal.weeklyBps, 3000n);
    assert.ok(profile60Proposal.executableAt > 0n);
    assert.equal(profile60Change.oldTicketPrice, DEFAULT_PRICE_6);
    assert.equal(profile60Change.oldJackpotBps, 5000n);
    assert.equal(profile60Change.newTicketPrice, DEFAULT_PRICE_6);
    assert.equal(profile60Change.newJackpotBps, 6000n);
    assert.equal(profile60Change.newWeeklyBps, 3000n);
    assertAddress(profile60Change.oldMaintenanceWallet, await x.maintenance.getAddress());
    assertAddress(profile60Change.newMaintenanceWallet, owner);
    const openOne = await x.lottery.rounds(1);
    assert.equal(openOne.jackpotBps, 5000n);
    assert.equal(openOne.weeklyBps, 3800n);
    assertAddress(openOne.maintenanceWallet, await x.maintenance.getAddress());
    assertAddress(openOne.oracleWallet, await x.oracle.getAddress());
    assertAddress(await x.lottery.maintenanceWallet(), owner);
    assertAddress(await x.lottery.oracleWallet(), owner);
    const settledOne = await settleCurrentRound(x, 101n);
    assert.equal(settledOne.round.totalAward, 1_900_000n, 'non-jackpot round pays only its snapshotted weekly pool');
    assert.equal(await x.lottery.jackpotReserve(), 2_500_000n, 'unwon jackpot rolls forward');

    const openTwo = await openNext(x);
    assert.equal(openTwo.jackpotBps, 6000n);
    assert.equal(openTwo.weeklyBps, 3000n);
    assert.equal(openTwo.maintenanceBps, 500n);
    assert.equal(openTwo.oracleBps, 500n);
    assertAddress(openTwo.maintenanceWallet, owner);
    assertAddress(openTwo.oracleWallet, owner);
    await (await x.lottery.connect(x.player).buyTicket(winningMask(202n))).wait();

    // A second scheduled change cannot alter a VRF-requested/current round either.
    const profile40Activation = await activateRoundConfig(x, profile40);
    const profile40Change = eventFrom(profile40Activation.activationReceipt, x.lottery, 'FutureRoundConfigActivated');
    assert.equal(profile40Change.oldJackpotBps, 6000n);
    assert.equal(profile40Change.newTicketPrice, 5_000_001n);
    assert.equal(profile40Change.newDuration, BigInt(DAY));
    assert.equal(profile40Change.newJackpotBps, 4000n);
    assert.equal(profile40Change.newWeeklyBps, 4000n);
    const stillTwo = await x.lottery.rounds(2);
    assert.equal(stillTwo.ticketPrice, DEFAULT_PRICE_6);
    assert.equal(stillTwo.jackpotBps, 6000n);
    assert.equal(stillTwo.weeklyBps, 3000n);
    const settledTwo = await settleCurrentRound(x, 202n);
    assert.equal(settledTwo.round.totalAward, 7_000_000n, 'round two receives its weekly pool plus the carried and current jackpot');
    assert.equal(await x.lottery.jackpotReserve(), 0n, 'exact winner consumes the carried jackpot only once');

    const openThree = await openNext(x);
    assert.equal(openThree.ticketPrice, 5_000_001n);
    assert.equal(openThree.duration, BigInt(DAY));
    assert.equal(openThree.jackpotBps, 4000n);
    assert.equal(openThree.weeklyBps, 4000n);
    assert.equal(openThree.maintenanceBps, 1000n);
    assert.equal(openThree.oracleBps, 1000n);
    assertAddress(openThree.maintenanceWallet, emergency);
    assertAddress(openThree.oracleWallet, attacker);
    await (await x.lottery.connect(x.player).buyTicket(aNonWinningMask(303n))).wait();

    assert.equal(await x.token.balanceOf(await x.maintenance.getAddress()), 300_000n, 'old maintenance wallet receives only its old-round fee');
    assert.equal(await x.token.balanceOf(await x.oracle.getAddress()), 300_000n, 'old oracle wallet receives only its old-round fee');
    assert.equal(await x.token.balanceOf(owner), 500_000n, '60/30/5/5 sends both 5% fees to its snapshotted wallet');
    assert.equal(await x.token.balanceOf(emergency), 500_000n);
    assert.equal(await x.token.balanceOf(attacker), 500_000n);
    assert.equal(await x.lottery.unallocatedDustReserve(), 1n, 'integer division dust is retained and auditable');
    await assertAccounting(x, 'three-profile economics regression');
  });

  it('rejects invalid or unauthorized future configuration without mutating the active/current snapshot', async () => {
    const x = await fixture();
    const activeBefore = await x.lottery.activeRoundConfig();
    const roundBefore = await x.lottery.rounds(1);
    const base = roundConfig(await x.maintenance.getAddress(), await x.oracle.getAddress());

    for (const bad of [
      { ...base, weeklyBps: 3801 },
      { ...base, ticketPrice: 0n },
      { ...base, roundDuration: DAY - 1 },
      { ...base, maintenanceWallet: ethers.ZeroAddress },
      { ...base, oracleWallet: ethers.ZeroAddress }
    ]) {
      await assert.rejects(async () => {
        const tx = await x.lottery.proposeFutureRoundConfig(bad);
        await tx.wait();
      });
    }
    await assert.rejects(async () => {
      const tx = await x.lottery.connect(x.attacker).proposeFutureRoundConfig(base);
      await tx.wait();
    });

    const activeAfter = await x.lottery.activeRoundConfig();
    const roundAfter = await x.lottery.rounds(1);
    assert.equal(activeAfter.ticketPrice, activeBefore.ticketPrice);
    assert.equal(activeAfter.jackpotBps, activeBefore.jackpotBps);
    assert.equal(roundAfter.ticketPrice, roundBefore.ticketPrice);
    assert.equal(roundAfter.jackpotBps, roundBefore.jackpotBps);
    assert.equal(await x.lottery.proposedRoundConfigAt(), 0n);
  });

  it('rejects fee-on-transfer, balance-delta, and false-return input tokens atomically', async () => {
    for (const tokenName of ['FeeToken', 'DeltaToken', 'FalseFromToken']) {
      const x = await fixture({ tokenName });
      await atomicPurchaseFailure(x, `${tokenName} input behavior`);
    }
  });

  it('rejects false-return and rejected maintenance/oracle fee transfers atomically', async () => {
    const falseTransfer = await fixture({ tokenName: 'FalseTransferToken' });
    await atomicPurchaseFailure(falseTransfer, 'false-return operational transfer');

    for (const recipient of ['maintenance', 'oracle']) {
      const x = await fixture({ tokenName: 'RejectRecipientToken' });
      const rejected = recipient === 'maintenance'
        ? await x.maintenance.getAddress()
        : await x.oracle.getAddress();
      await (await x.token.setRejected(rejected)).wait();
      await atomicPurchaseFailure(x, `rejected ${recipient} fee recipient`);
    }
  });

  it('prevents reentrant purchase/claim attempts from creating duplicate tickets, fees, or liabilities', async () => {
    const x = await fixture({ tokenName: 'ReentrantToken' });
    const exactWord = 991n;
    const mask = winningMask(exactWord);

    await (await x.token.arm(await x.lottery.getAddress(), mask, true, false)).wait();
    await (await x.lottery.connect(x.player).buyTicket(mask)).wait();
    let round = await x.lottery.rounds(1);
    assert.equal(round.ticketCount, 1n);
    assert.equal(await x.lottery.nextTicketIndex(), 1n);
    assert.equal(await x.token.balanceOf(await x.maintenance.getAddress()), 300_000n);
    assert.equal(await x.token.balanceOf(await x.oracle.getAddress()), 300_000n);
    await assertAccounting(x, 'reentrant purchase attempt');

    const settled = await settleCurrentRound(x, exactWord);
    const due = settled.round.totalAward;
    assert.equal(await x.lottery.playerLiabilities(), due);
    const beforePlayer = await x.token.balanceOf(await x.player.getAddress());
    await (await x.token.arm(await x.lottery.getAddress(), mask, false, true)).wait();
    await (await x.lottery.connect(x.player).claim(1, 0)).wait();
    assert.equal((await x.token.balanceOf(await x.player.getAddress())) - beforePlayer, due);
    assert.equal(await x.lottery.playerLiabilities(), 0n);
    await assert.rejects(async () => {
      const tx = await x.lottery.connect(x.player).claim(1, 0);
      await tx.wait();
    });
    await assertAccounting(x, 'reentrant claim attempt');
  });

  it('preserves historical claim entitlement after a later future config becomes active', async () => {
    const x = await fixture();
    const word = 717n;
    await (await x.lottery.connect(x.player).buyTicket(winningMask(word))).wait();
    const settled = await settleCurrentRound(x, word);
    const roundOneBeforeConfig = await x.lottery.rounds(1);
    const entitlement = await x.lottery.ticketEntitlement(1, 0);
    assert.equal(entitlement[4], settled.round.totalAward);

    await activateRoundConfig(x, roundConfig(await x.owner.getAddress(), await x.owner.getAddress(), {
      jackpotBps: 6000,
      weeklyBps: 3000,
      maintenanceBps: 500,
      oracleBps: 500
    }));
    const before = await accounting(x);
    const playerBefore = await x.token.balanceOf(await x.player.getAddress());
    await (await x.lottery.connect(x.player).claim(1, 0)).wait();
    const after = await accounting(x);
    const roundOneAfterConfig = await x.lottery.rounds(1);

    assert.equal((await x.token.balanceOf(await x.player.getAddress())) - playerBefore, entitlement[4]);
    assert.equal(after.playerLiabilities, before.playerLiabilities - entitlement[4]);
    assert.equal(after.balance, before.balance - entitlement[4]);
    assert.equal(roundOneAfterConfig.ticketPrice, roundOneBeforeConfig.ticketPrice);
    assert.equal(roundOneAfterConfig.jackpotBps, roundOneBeforeConfig.jackpotBps);
    await assertAccounting(x, 'historical claim after config activation');
  });

  it('migrates retained non-liability funds only, after immediate fees, and leaves historical claims funded', async () => {
    const x = await fixture();
    const word = 404n;
    await (await x.lottery.connect(x.player).buyTicket(aNonWinningMask(word))).wait();
    const settled = await settleCurrentRound(x, word);
    assert.equal(settled.round.totalAward, 1_900_000n);
    assert.equal(await x.lottery.playerLiabilities(), 1_900_000n);
    assert.equal(await x.lottery.jackpotReserve(), 2_500_000n);
    assert.equal(await x.token.balanceOf(await x.maintenance.getAddress()), 300_000n);
    assert.equal(await x.token.balanceOf(await x.oracle.getAddress()), 300_000n);

    const receiver = await x.deploy(Receiver);
    const before = await accounting(x);
    const migratable = await x.lottery.migratableBalance();
    assert.equal(migratable, before.balance - before.playerLiabilities);
    assert.equal(migratable, 2_500_000n, 'operational fees are already external and cannot be migrated');
    await (await x.lottery.proposeMigration(await receiver.getAddress())).wait();
    await advance(x.provider, MIGRATION_DELAY + 1);
    await (await x.lottery.executeMigration()).wait();

    assert.equal(await receiver.receivedAmount(), migratable);
    assert.equal(await x.token.balanceOf(await x.lottery.getAddress()), before.playerLiabilities);
    assert.equal(await x.lottery.playerLiabilities(), before.playerLiabilities);
    assert.equal(await x.lottery.migrationState(), 3n);
    const playerBefore = await x.token.balanceOf(await x.player.getAddress());
    await (await x.lottery.connect(x.player).claim(1, 0)).wait();
    assert.equal((await x.token.balanceOf(await x.player.getAddress())) - playerBefore, settled.round.totalAward);
    assert.equal(await x.lottery.playerLiabilities(), 0n);
    assert.equal(await x.token.balanceOf(await x.lottery.getAddress()), 0n);
  });

  it('keeps pause/emergency authority scoped and blocks sales without changing configuration or reserves', async () => {
    const x = await fixture();
    const before = await accounting(x);
    await assert.rejects(async () => {
      const tx = await x.lottery.connect(x.attacker).setEmergencyPause(true, ethers.id('unauthorized'));
      await tx.wait();
    });
    await (await x.lottery.connect(x.emergency).setEmergencyPause(true, ethers.id('maintenance-window'))).wait();
    await atomicPurchaseFailure(x, 'paused sales');
    assert.equal(await x.lottery.paused(), true);
    assert.deepEqual(await accounting(x), before);
    await (await x.lottery.connect(x.emergency).setEmergencyPause(false, ethers.id('resume'))).wait();
    await (await x.lottery.connect(x.player).buyTicket(ticketMask())).wait();
    assert.equal((await x.lottery.rounds(1)).ticketCount, 1n);
    await assertAccounting(x, 'post-pause purchase');
  });

  it('keeps a requested round on its economic snapshot when future economics activate before authenticated VRF fulfillment', async () => {
    const x = await fixture();
    const word = 909n;
    await (await x.lottery.connect(x.player).buyTicket(winningMask(word))).wait();
    const id = await x.lottery.currentRoundId();
    const before = await x.lottery.rounds(id);
    await advance(x.provider, Number(before.duration) + 1);
    await (await x.lottery.closeRound(id)).wait();
    await (await x.lottery.requestRandomness(id)).wait();
    const requested = await x.lottery.rounds(id);
    const requestId = requested.requestId;

    await activateRoundConfig(x, roundConfig(await x.owner.getAddress(), await x.owner.getAddress(), {
      jackpotBps: 6000,
      weeklyBps: 3000,
      maintenanceBps: 500,
      oracleBps: 500
    }));
    const snapBeforeCallback = await x.lottery.rounds(id);
    assert.equal(snapBeforeCallback.ticketPrice, DEFAULT_PRICE_6);
    assert.equal(snapBeforeCallback.jackpotBps, 5000n);
    assert.equal(snapBeforeCallback.weeklyBps, 3800n);
    assert.equal(await x.lottery.requestIdToRoundId(requestId), id);

    await (await x.coordinator.fulfill(requestId, word)).wait();
    await (await x.lottery.processSettlement(id, 1)).wait();
    const finalized = await x.lottery.rounds(id);
    const evidence = await x.lottery.drawEvidence(id);
    assert.equal(finalized.drawMethod, 1n, 'the authenticated callback remains Chainlink VRF');
    assert.equal(finalized.totalAward, 4_400_000n, 'settlement must use the original weekly/jackpot snapshot');
    assert.equal(evidence[2], requestId);
    assertAddress(evidence[3], await x.coordinator.getAddress(), 'draw evidence coordinator');
    assert.equal(await x.lottery.requestIdToRoundId(requestId), id);
    await assertAccounting(x, 'VRF after future config activation');

    const next = await openNext(x);
    assert.equal(next.jackpotBps, 6000n, 'only the future round receives the new economics');
    assert.equal(next.weeklyBps, 3000n);
  });
});
