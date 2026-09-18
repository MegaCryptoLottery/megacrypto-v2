import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ethers } from 'ethers';
import ganache from 'ganache';
import { artifact, advance, ticketMask, winningMask } from './helpers.mjs';

const compiled = JSON.parse(fs.readFileSync(new URL('../artifacts/production-candidate.json', import.meta.url), 'utf8'));
const Lottery = compiled['MegaCryptoLotteryV2ProductionCandidate.sol'].MegaCryptoLotteryV2ProductionCandidate;
const Coordinator = compiled['mocks/OfficialVrfCoordinatorMock.sol'].OfficialVrfCoordinatorMock;
const ValidReceiver = compiled['mocks/ValidMigrationReceiver.sol'].ValidMigrationReceiver;
const ROUND_DURATION = 604800;
const VRF_TIMEOUT = 259200;
const MIGRATION_DELAY = 604800;

async function fixture() {
  const provider = new ethers.BrowserProvider(ganache.provider({ logging: { quiet: true }, chain: { chainId: 31337, time: new Date('2026-01-01T00:00:00Z') } }));
  const owner = await provider.getSigner(0), emergencyA = await provider.getSigner(1), player = await provider.getSigner(2), attacker = await provider.getSigner(3), emergencyB = await provider.getSigner(4), pendingOwner = await provider.getSigner(5);
  const deploy = async (a, args = [], signer = owner) => { const c = await new ethers.ContractFactory(a.abi, a.evm.bytecode.object, signer).deploy(...args); await c.waitForDeployment(); return c; };
  const token = await deploy(artifact('mocks/MockERC20.sol', 'MockERC20'), [6]);
  const coordinator = await deploy(Coordinator);
  const lottery = await deploy(Lottery, [await token.getAddress(), 6, ROUND_DURATION, 5000000n, { coordinator: await coordinator.getAddress(), subscriptionId: 1n, keyHash: ethers.ZeroHash, callbackGasLimit: 500000, requestConfirmations: 3, numWords: 1, payWithNative: true }, await emergencyA.getAddress()]);
  await (await token.mint(await player.getAddress(), 100000000n)).wait();
  await (await token.connect(player).approve(await lottery.getAddress(), ethers.MaxUint256)).wait();
  return { provider, owner, emergencyA, player, attacker, emergencyB, pendingOwner, token, coordinator, lottery, deploy };
}

async function snapshot(z, roundId) {
  if (roundId === undefined) roundId = await z.lottery.currentRoundId();
  const r = await z.lottery.rounds(roundId);
  return {
    balance: await z.token.balanceOf(await z.lottery.getAddress()),
    playerLiabilities: await z.lottery.playerLiabilities(),
    jackpotReserve: await z.lottery.jackpotReserve(),
    weeklyPool: r.weeklyPool,
    maintenanceReserve: await z.lottery.maintenanceReserve(),
    oracleReserve: await z.lottery.oracleReserve(),
    unallocatedDustReserve: await z.lottery.unallocatedDustReserve(),
    ticketCount: r.ticketCount,
    settlementCursor: r.settlementCursor,
    roundState: r.state,
    winningMask: r.winningMask,
    drawMethod: r.drawMethod,
    migrationState: await z.lottery.migrationState(),
    emergencyAuthority: await z.lottery.emergencyAuthority()
  };
}

async function resolveExactPrize(z, word = 808n) {
  await (await z.lottery.connect(z.player).buyTicket(winningMask(word))).wait();
  await advance(z.provider, ROUND_DURATION + 1);
  await (await z.lottery.closeRound(1)).wait();
  await (await z.lottery.requestRandomness(1)).wait();
  await (await z.coordinator.fulfill(1, word)).wait();
  await (await z.lottery.processSettlement(1, 1)).wait();
  assert.equal((await z.lottery.rounds(1)).state, 5n);
}

describe('production candidate pause and emergency authority gate', function () {
  it('separates owner, emergency, and unauthorized powers while pausing and recovering an OPEN round', async () => {
    const z = await fixture();
    const initial = await snapshot(z);
    await assert.rejects(z.lottery.connect(z.attacker).setEmergencyPause(true, ethers.id('attack')).then((tx) => tx.wait()));
    await assert.rejects(z.lottery.connect(z.attacker).setEmergencyAuthority(await z.attacker.getAddress()).then((tx) => tx.wait()));
    await assert.rejects(z.lottery.connect(z.emergencyA).setEmergencyAuthority(await z.emergencyB.getAddress()).then((tx) => tx.wait()));
    await assert.rejects(z.lottery.connect(z.emergencyA).transferOwnership(await z.emergencyA.getAddress()).then((tx) => tx.wait()));
    await assert.deepEqual(await snapshot(z), initial);

    await (await z.lottery.connect(z.emergencyA).setEmergencyPause(true, ethers.id('open-pause'))).wait();
    const paused = await snapshot(z);
    await assert.rejects(z.lottery.connect(z.player).buyTicket(ticketMask()).then((tx) => tx.wait()));
    assert.deepEqual(await snapshot(z), paused, 'paused rejected purchase must not change accounting or tickets');
    await (await z.lottery.connect(z.emergencyA).setEmergencyPause(false, ethers.id('open-resume'))).wait();
    assert.equal(await z.lottery.paused(), false);
    await (await z.lottery.connect(z.player).buyTicket(ticketMask())).wait();
    assert.equal((await z.lottery.rounds(1)).ticketCount, 1n);
  });

  it('keeps earned claims callable while paused and prevents duplicate claims', async () => {
    const z = await fixture();
    await resolveExactPrize(z);
    const entitlement = await z.lottery.ticketEntitlement(1, 0);
    const before = await snapshot(z);
    const winnerBalance = await z.token.balanceOf(await z.player.getAddress());
    await (await z.lottery.connect(z.emergencyA).setEmergencyPause(true, ethers.id('claim-pause'))).wait();
    await (await z.lottery.connect(z.player).claim(1, 0)).wait();
    const after = await snapshot(z);
    assert.equal((await z.token.balanceOf(await z.player.getAddress())) - winnerBalance, entitlement[4]);
    assert.equal(after.playerLiabilities, before.playerLiabilities - entitlement[4]);
    assert.equal(after.balance, before.balance - entitlement[4]);
    assert.equal(after.jackpotReserve, before.jackpotReserve);
    assert.equal(after.maintenanceReserve, before.maintenanceReserve);
    assert.equal(after.oracleReserve, before.oracleReserve);
    await assert.rejects(z.lottery.connect(z.player).claim(1, 0).then((tx) => tx.wait()));
  });

  it('blocks lifecycle entry while paused but permits exactly one authenticated callback and safe settlement recovery', async () => {
    const z = await fixture();
    await (await z.lottery.connect(z.player).buyTicket(ticketMask())).wait();
    await (await z.lottery.connect(z.player).buyTicket(ticketMask())).wait();
    await advance(z.provider, ROUND_DURATION + 1);
    await (await z.lottery.closeRound(1)).wait();

    await (await z.lottery.connect(z.emergencyA).setEmergencyPause(true, ethers.id('closed-pause'))).wait();
    const closedPaused = await snapshot(z);
    await assert.rejects(z.lottery.requestRandomness(1).then((tx) => tx.wait()));
    assert.deepEqual(await snapshot(z), closedPaused);
    await (await z.lottery.connect(z.emergencyA).setEmergencyPause(false, ethers.id('closed-resume'))).wait();
    assert.equal(await z.lottery.paused(), false);
    await (await z.lottery.requestRandomness(1, { gasLimit: 500000n })).wait();
    const requestId = (await z.lottery.rounds(1)).requestId;

    await (await z.lottery.connect(z.emergencyA).setEmergencyPause(true, ethers.id('vrf-pause'))).wait();
    await (await z.coordinator.fulfill(requestId, 456789)).wait();
    const fulfilledPaused = await snapshot(z);
    assert.equal(fulfilledPaused.roundState, 3n, 'authenticated callback is intentionally not pause-gated');
    assert.equal(fulfilledPaused.drawMethod, 1n);
    await assert.rejects(z.coordinator.fulfill(requestId, 987654).then((tx) => tx.wait()));
    assert.deepEqual(await snapshot(z), fulfilledPaused, 'duplicate callback remains neutralized while paused');

    await (await z.lottery.connect(z.emergencyA).setEmergencyPause(false, ethers.id('settle-first'))).wait();
    assert.equal(await z.lottery.paused(), false);
    await (await z.lottery.processSettlement(1, 1, { gasLimit: 500000n })).wait();
    const partial = await snapshot(z);
    assert.equal(partial.roundState, 4n);
    await (await z.lottery.connect(z.emergencyA).setEmergencyPause(true, ethers.id('settlement-pause'))).wait();
    const settlementPaused = await snapshot(z);
    await assert.rejects(z.lottery.processSettlement(1, 1).then((tx) => tx.wait()));
    assert.deepEqual(await snapshot(z), settlementPaused, 'paused settlement cannot move the cursor or accounting');
    await (await z.lottery.connect(z.emergencyA).setEmergencyPause(false, ethers.id('settlement-resume'))).wait();
    assert.equal(await z.lottery.paused(), false);
    await (await z.lottery.processSettlement(1, 1, { gasLimit: 500000n })).wait();
    assert.equal((await z.lottery.rounds(1)).state, 5n);
  });

  it('enforces emergency contingency timing and preserves manual draw evidence against a late callback', async () => {
    const z = await fixture();
    await (await z.lottery.connect(z.player).buyTicket(ticketMask())).wait();
    await advance(z.provider, ROUND_DURATION + 1);
    await (await z.lottery.closeRound(1)).wait();
    await (await z.lottery.requestRandomness(1)).wait();
    const requestId = (await z.lottery.rounds(1)).requestId;
    await assert.rejects(z.lottery.connect(z.attacker).executeManualContingency(1, 7, ethers.id('x'), ethers.id('y'), { gasLimit: 500000n }).then((tx) => tx.wait()));
    await assert.rejects(z.lottery.connect(z.emergencyA).executeManualContingency(1, 7, ethers.id('x'), ethers.id('y'), { gasLimit: 500000n }).then((tx) => tx.wait()));
    await advance(z.provider, VRF_TIMEOUT + 1);
    const reason = ethers.id('timeout'), evidence = ethers.id('incident-evidence');
    await (await z.lottery.connect(z.emergencyA).executeManualContingency(1, 7, reason, evidence, { gasLimit: 500000n })).wait();
    const manual = await z.lottery.rounds(1);
    const drawEvidence = await z.lottery.drawEvidence(1);
    assert.equal(manual.drawMethod, 2n);
    assert.equal(drawEvidence[0], 2n);
    assert.equal(drawEvidence[10], reason);
    assert.equal(drawEvidence[11], evidence);
    await (await z.lottery.processSettlement(1, 1)).wait();
    const afterSettlement = await snapshot(z);
    await assert.rejects(z.coordinator.fulfill(requestId, 999).then((tx) => tx.wait()));
    assert.deepEqual(await snapshot(z), afterSettlement);
  });

  it('rotates emergency authority and preserves its separation across two-step ownership transfer', async () => {
    const z = await fixture();
    const before = await snapshot(z);
    await assert.rejects(z.lottery.connect(z.attacker).setEmergencyAuthority(await z.emergencyB.getAddress()).then((tx) => tx.wait()));
    assert.equal((await z.lottery.owner()).toLowerCase(), (await z.owner.getAddress()).toLowerCase());
    await (await z.lottery.connect(z.owner).setEmergencyAuthority(await z.emergencyB.getAddress(), { gasLimit: 500000n })).wait();
    assert.equal((await z.lottery.emergencyAuthority()).toLowerCase(), (await z.emergencyB.getAddress()).toLowerCase());
    await assert.rejects(z.lottery.connect(z.emergencyA).setEmergencyPause(true, ethers.id('old-authority')).then((tx) => tx.wait()));
    await (await z.lottery.connect(z.emergencyB).setEmergencyPause(true, ethers.id('new-authority'))).wait();
    await (await z.lottery.connect(z.emergencyB).setEmergencyPause(false, ethers.id('new-authority-resume'))).wait();
    assert.equal((await z.lottery.playerLiabilities()), before.playerLiabilities);
    assert.equal((await z.lottery.jackpotReserve()), before.jackpotReserve);

    await (await z.lottery.connect(z.owner).transferOwnership(await z.pendingOwner.getAddress())).wait();
    await assert.rejects(z.lottery.connect(z.pendingOwner).setEmergencyAuthority(await z.emergencyA.getAddress()).then((tx) => tx.wait()));
    await (await z.lottery.connect(z.pendingOwner).acceptOwnership()).wait();
    await assert.rejects(z.lottery.connect(z.owner).setEmergencyAuthority(await z.emergencyA.getAddress()).then((tx) => tx.wait()));
    assert.equal((await z.lottery.emergencyAuthority()).toLowerCase(), (await z.emergencyB.getAddress()).toLowerCase(), 'ownership transfer must not silently rotate emergency authority');
    await (await z.lottery.connect(z.pendingOwner).setEmergencyAuthority(await z.emergencyA.getAddress(), { gasLimit: 500000n })).wait();
    assert.equal((await z.lottery.emergencyAuthority()).toLowerCase(), (await z.emergencyA.getAddress()).toLowerCase());
  });

  it('keeps claims-only migration terminal while preserving a paused historical claim', async () => {
    const z = await fixture();
    await resolveExactPrize(z, 919n);
    const receiver = await z.deploy(ValidReceiver);
    await (await z.lottery.proposeMigration(await receiver.getAddress())).wait();
    await advance(z.provider, MIGRATION_DELAY + 1);
    await (await z.lottery.executeMigration()).wait();
    assert.equal(await z.lottery.migrationState(), 3n);
    await (await z.lottery.connect(z.emergencyA).setEmergencyPause(true, ethers.id('claims-only-pause'))).wait();
    const terminalBefore = await snapshot(z);
    await assert.rejects(z.lottery.connect(z.player).buyTicket(ticketMask()).then((tx) => tx.wait()));
    await assert.rejects(z.lottery.openNextRound().then((tx) => tx.wait()));
    await assert.rejects(z.lottery.executeMigration().then((tx) => tx.wait()));
    await assert.rejects(z.lottery.connect(z.emergencyA).executeManualContingency(1, 1, ethers.ZeroHash, ethers.ZeroHash, { gasLimit: 500000n }).then((tx) => tx.wait()));
    assert.deepEqual(await snapshot(z), terminalBefore);
    const entitlement = await z.lottery.ticketEntitlement(1, 0);
    const winnerBalance = await z.token.balanceOf(await z.player.getAddress());
    await (await z.lottery.connect(z.player).claim(1, 0)).wait();
    assert.equal((await z.token.balanceOf(await z.player.getAddress())) - winnerBalance, entitlement[4]);
    assert.equal(await z.lottery.playerLiabilities(), 0n);
    await assert.rejects(z.lottery.connect(z.player).claim(1, 0).then((tx) => tx.wait()));
  });
});

