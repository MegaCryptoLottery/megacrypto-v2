import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ethers } from 'ethers';
import ganache from 'ganache';
import { artifact, advance, ticketMask, winningMask } from './helpers.mjs';

const compiled = JSON.parse(fs.readFileSync(new URL('../artifacts/production-candidate.json', import.meta.url), 'utf8'));
const Lottery = compiled['MegaCryptoLotteryV2ProductionCandidate.sol'].MegaCryptoLotteryV2ProductionCandidate;
const Coordinator = compiled['mocks/OfficialVrfCoordinatorMock.sol'].OfficialVrfCoordinatorMock;
const Receiver = compiled['mocks/ValidMigrationReceiver.sol'].ValidMigrationReceiver;
const ROUND_DURATION = 604800;
const MIGRATION_DELAY = 604800;

async function fixture() {
  const provider = new ethers.BrowserProvider(ganache.provider({ logging: { quiet: true }, chain: { chainId: 31337, time: new Date('2026-01-01T00:00:00Z') } }));
  const owner = await provider.getSigner(0), playerA = await provider.getSigner(1), playerB = await provider.getSigner(2), playerC = await provider.getSigner(3);
  const deploy = async (a, args = [], signer = owner) => { const c = await new ethers.ContractFactory(a.abi, a.evm.bytecode.object, signer).deploy(...args); await c.waitForDeployment(); return c; };
  const token = await deploy(artifact('mocks/MockERC20.sol', 'MockERC20'), [6]);
  const coordinator = await deploy(Coordinator);
  const lottery = await deploy(Lottery, [await token.getAddress(), 6, ROUND_DURATION, 5000000n, { coordinator: await coordinator.getAddress(), subscriptionId: 1n, keyHash: ethers.ZeroHash, callbackGasLimit: 500000, requestConfirmations: 3, numWords: 1, payWithNative: true }, await owner.getAddress()]);
  for (const player of [playerA, playerB, playerC]) {
    await (await token.mint(await player.getAddress(), 100000000n)).wait();
    await (await token.connect(player).approve(await lottery.getAddress(), ethers.MaxUint256)).wait();
  }
  return { provider, owner, playerA, playerB, playerC, token, coordinator, lottery, deploy };
}

async function resolveRound(z, roundId, purchases, word) {
  for (const [player, mask] of purchases) await (await z.lottery.connect(player).buyTicket(mask)).wait();
  await advance(z.provider, ROUND_DURATION + 1);
  await (await z.lottery.closeRound(roundId)).wait();
  await (await z.lottery.requestRandomness(roundId)).wait();
  const requestId = (await z.lottery.rounds(roundId)).requestId;
  await (await z.coordinator.fulfill(requestId, word)).wait();
  const count = (await z.lottery.rounds(roundId)).ticketCount;
  await (await z.lottery.processSettlement(roundId, count)).wait();
  const round = await z.lottery.rounds(roundId);
  assert.equal(round.state, 5n);
  return { requestId, round };
}

async function accounting(z) {
  const current = await z.lottery.currentRoundId();
  const activeWeekly = (await z.lottery.rounds(current)).weeklyPool;
  const values = {
    balance: await z.token.balanceOf(await z.lottery.getAddress()),
    playerLiabilities: await z.lottery.playerLiabilities(),
    jackpotReserve: await z.lottery.jackpotReserve(),
    maintenanceReserve: await z.lottery.maintenanceReserve(),
    oracleReserve: await z.lottery.oracleReserve(),
    unallocatedDustReserve: await z.lottery.unallocatedDustReserve(),
    activeWeekly
  };
  values.protectedAmount = values.playerLiabilities + values.jackpotReserve + values.maintenanceReserve + values.oracleReserve + values.unallocatedDustReserve + values.activeWeekly;
  values.legallyMigratable = values.balance > values.playerLiabilities ? values.balance - values.playerLiabilities : 0n;
  return values;
}

async function migrationExecutionSnapshot(z, receiver) {
  return {
    migrationState: await z.lottery.migrationState(),
    proposedSuccessor: await z.lottery.proposedSuccessor(),
    migrationExecutableAt: await z.lottery.migrationExecutableAt(),
    currentRound: await z.lottery.currentRoundId(),
    currentRoundState: (await z.lottery.rounds(await z.lottery.currentRoundId())).state,
    accounting: await accounting(z),
    receiverBalance: await z.token.balanceOf(await receiver.getAddress())
  };
}

async function deployValidReceiver(z) { return z.deploy(Receiver); }

describe('production candidate migration liabilities gate', function () {
  it('migrates only non-liability funds and preserves all historical claims in the old contract', async () => {
    const z = await fixture();
    const exactA = winningMask(101n);
    const exactB = winningMask(202n);
    const sharedWeeklyMask = ticketMask();
    assert.notEqual(sharedWeeklyMask, winningMask(303n), 'round three must be a weekly, non-jackpot result');

    // Round 1 creates two jackpot winners; Round 2 creates another jackpot winner.
    const roundOne = await resolveRound(z, 1, [[z.playerA, exactA], [z.playerB, exactA]], 101n);
    await (await z.lottery.openNextRound()).wait();
    const roundTwo = await resolveRound(z, 2, [[z.playerA, exactB]], 202n);
    await (await z.lottery.openNextRound()).wait();
    // Round 3 creates two tied weekly-pool winners and leaves a jackpot reserve.
    const roundThree = await resolveRound(z, 3, [[z.playerA, sharedWeeklyMask], [z.playerC, sharedWeeklyMask]], 303n);

    assert.equal(roundOne.round.totalAward, 8800000n);
    assert.equal(roundTwo.round.totalAward, 4400000n);
    assert.equal(roundThree.round.totalAward, 3800000n);
    assert.equal(roundThree.round.finalistCount, 2n);
    assert.equal(await z.lottery.playerLiabilities(), 17000000n);
    assert.equal(await z.lottery.jackpotReserve(), 5000000n);
    assert.equal(await z.lottery.maintenanceReserve(), 1500000n);
    assert.equal(await z.lottery.oracleReserve(), 1500000n);
    assert.equal(await z.lottery.unallocatedDustReserve(), 0n, 'the fixed 10000 BPS allocation leaves no percentage dust');

    const beforeMigration = await accounting(z);
    assert.equal(beforeMigration.balance, 25000000n);
    assert.equal(beforeMigration.protectedAmount, beforeMigration.balance);
    assert.equal(beforeMigration.legallyMigratable, 8000000n);
    assert.equal(await z.lottery.migratableBalance(), beforeMigration.legallyMigratable);

    const receiver = await deployValidReceiver(z);
    await (await z.lottery.proposeMigration(await receiver.getAddress())).wait();
    await assert.rejects(z.lottery.connect(z.playerA).buyTicket(ticketMask()).then((tx) => tx.wait()));
    await advance(z.provider, MIGRATION_DELAY + 1);
    await (await z.lottery.executeMigration()).wait();

    assert.equal(await z.lottery.migrationState(), 3n);
    assert.equal(await receiver.receivedAmount(), beforeMigration.legallyMigratable);
    assert.equal(await z.token.balanceOf(await receiver.getAddress()), beforeMigration.legallyMigratable);
    assert.equal(await z.token.balanceOf(await z.lottery.getAddress()), beforeMigration.playerLiabilities);
    assert.equal(await z.lottery.playerLiabilities(), beforeMigration.playerLiabilities);
    assert.equal(await z.lottery.migratableBalance(), 0n);
    await assert.rejects(z.lottery.connect(z.playerA).buyTicket(ticketMask()).then((tx) => tx.wait()));

    const storedReservesAfterMigration = await accounting(z);
    assert.equal(storedReservesAfterMigration.jackpotReserve, beforeMigration.jackpotReserve);
    assert.equal(storedReservesAfterMigration.maintenanceReserve, beforeMigration.maintenanceReserve);
    assert.equal(storedReservesAfterMigration.oracleReserve, beforeMigration.oracleReserve);
    // In claims-only mode, the exact liability is the old-contract protection;
    // reserves were the production contract's permitted migration amount.
    assert.equal(storedReservesAfterMigration.balance, storedReservesAfterMigration.playerLiabilities);

    const claimAndReconcile = async (player, roundId, offset) => {
      const entitlement = await z.lottery.ticketEntitlement(roundId, offset);
      const amount = entitlement[4];
      const beforePlayer = await z.token.balanceOf(await player.getAddress());
      const before = await accounting(z);
      await (await z.lottery.connect(player).claim(roundId, offset)).wait();
      const after = await accounting(z);
      assert.equal((await z.token.balanceOf(await player.getAddress())) - beforePlayer, amount);
      assert.equal(after.playerLiabilities, before.playerLiabilities - amount);
      assert.equal(after.balance, before.balance - amount);
      assert.equal(after.balance, after.playerLiabilities, 'all remaining old-contract funds must equal outstanding claims');
      assert.equal(after.jackpotReserve, before.jackpotReserve);
      assert.equal(after.maintenanceReserve, before.maintenanceReserve);
      assert.equal(after.oracleReserve, before.oracleReserve);
      assert.equal(after.unallocatedDustReserve, before.unallocatedDustReserve);
      return amount;
    };

    // Nonchronological historical claims: later Round 2 before Round 1; player A claims three rounds.
    assert.equal(await claimAndReconcile(z.playerA, 2, 0), 4400000n);
    assert.equal(await claimAndReconcile(z.playerA, 1, 0), 4400000n);
    assert.equal(await claimAndReconcile(z.playerB, 1, 1), 4400000n);
    assert.equal(await claimAndReconcile(z.playerC, 3, 1), 1900000n);
    assert.equal(await claimAndReconcile(z.playerA, 3, 0), 1900000n);
    assert.equal(await z.lottery.playerLiabilities(), 0n);
    assert.equal(await z.token.balanceOf(await z.lottery.getAddress()), 0n);
    await assert.rejects(z.lottery.connect(z.playerA).claim(2, 0).then((tx) => tx.wait()));
    assert.equal(await z.token.balanceOf(await z.lottery.getAddress()), 0n);
  });

  for (const [name, prepare] of [
    ['OPEN', async (z) => {}],
    ['CLOSED', async (z) => { await (await z.lottery.connect(z.playerA).buyTicket(ticketMask())).wait(); await advance(z.provider, ROUND_DURATION + 1); await (await z.lottery.closeRound(1)).wait(); }],
    ['VRF_REQUESTED', async (z) => { await (await z.lottery.connect(z.playerA).buyTicket(ticketMask())).wait(); await advance(z.provider, ROUND_DURATION + 1); await (await z.lottery.closeRound(1)).wait(); await (await z.lottery.requestRandomness(1)).wait(); }],
    ['SETTLEMENT', async (z) => { await (await z.lottery.connect(z.playerA).buyTicket(ticketMask())).wait(); await (await z.lottery.connect(z.playerB).buyTicket(ticketMask())).wait(); await advance(z.provider, ROUND_DURATION + 1); await (await z.lottery.closeRound(1)).wait(); await (await z.lottery.requestRandomness(1)).wait(); await (await z.coordinator.fulfill(1, 404)).wait(); await (await z.lottery.processSettlement(1, 1)).wait(); assert.equal((await z.lottery.rounds(1)).state, 4n); }]
  ]) {
    it(`atomically blocks migration while the current round is ${name}`, async () => {
      const z = await fixture();
      await prepare(z);
      const receiver = await deployValidReceiver(z);
      await (await z.lottery.proposeMigration(await receiver.getAddress())).wait();
      await advance(z.provider, MIGRATION_DELAY + 1);
      const before = await migrationExecutionSnapshot(z, receiver);
      await assert.rejects(z.lottery.executeMigration().then((tx) => tx.wait()));
      assert.deepEqual(await migrationExecutionSnapshot(z, receiver), before, 'failed migration execution must be atomic');
      assert.equal(await receiver.receiveCount(), 0n);
    });
  }
});

