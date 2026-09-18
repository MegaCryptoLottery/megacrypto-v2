import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ethers } from 'ethers';
import ganache from 'ganache';
import { artifact, advance, ticketMask } from './helpers.mjs';

const compiled = JSON.parse(fs.readFileSync(new URL('../artifacts/production-candidate.json', import.meta.url), 'utf8'));
const Lottery = compiled['MegaCryptoLotteryV2ProductionCandidate.sol'].MegaCryptoLotteryV2ProductionCandidate;
const Coordinator = compiled['mocks/OfficialVrfCoordinatorMock.sol'].OfficialVrfCoordinatorMock;
const HostileCoordinator = compiled['mocks/HostileVrfCoordinator.sol'].HostileVrfCoordinator;

async function fixture() {
  const provider = new ethers.BrowserProvider(ganache.provider({ logging: { quiet: true } })); provider.pollingInterval = 5;
  const owner = await provider.getSigner(0), player = await provider.getSigner(1);
  const deploy = async (a, args = []) => { const c = await new ethers.ContractFactory(a.abi, a.evm.bytecode.object, owner).deploy(...args); await c.waitForDeployment(); return c; };
  const token = await deploy(artifact('mocks/MockERC20.sol', 'MockERC20'), [6]);
  const coordinator = await deploy(Coordinator);
  const lottery = await deploy(Lottery, [await token.getAddress(), 6, 604800, 5000000n, { coordinator: await coordinator.getAddress(), subscriptionId: 1n, keyHash: ethers.ZeroHash, callbackGasLimit: 500000, requestConfirmations: 3, numWords: 1, payWithNative: true }, await owner.getAddress()]);
  await (await token.mint(await player.getAddress(), 100000000n)).wait(); await (await token.connect(player).approve(await lottery.getAddress(), ethers.MaxUint256)).wait();
  return { provider, owner, player, token, coordinator, lottery };
}

async function hostileRequestFixture() {
  const provider = new ethers.BrowserProvider(ganache.provider({ logging: { quiet: true } })); provider.pollingInterval = 5;
  const owner = await provider.getSigner(0), player = await provider.getSigner(1);
  const deploy = async (a, args = []) => { const c = await new ethers.ContractFactory(a.abi, a.evm.bytecode.object, owner).deploy(...args); await c.waitForDeployment(); return c; };
  const token = await deploy(artifact('mocks/MockERC20.sol', 'MockERC20'), [6]);
  const coordinator = await deploy(HostileCoordinator);
  const lottery = await deploy(Lottery, [await token.getAddress(), 6, 604800, 5000000n, { coordinator: await coordinator.getAddress(), subscriptionId: 1n, keyHash: ethers.ZeroHash, callbackGasLimit: 500000, requestConfirmations: 3, numWords: 1, payWithNative: true }, await owner.getAddress()]);
  await (await token.mint(await player.getAddress(), 100000000n)).wait();
  await (await token.connect(player).approve(await lottery.getAddress(), ethers.MaxUint256)).wait();
  await (await coordinator.configureAttack(await lottery.getAddress(), 1)).wait();
  return { provider, owner, player, token, coordinator, lottery };
}
async function snapshot(z, id) { const r = await z.lottery.rounds(1); return [id, await z.lottery.requestIdToRoundId(id), r.state, r.winningMask, r.drawMethod, r.bestScore, r.finalistCount, r.totalAward, await z.lottery.playerLiabilities(), await z.lottery.jackpotReserve(), r.weeklyPool, await z.lottery.maintenanceReserve(), await z.lottery.oracleReserve(), await z.lottery.unallocatedDustReserve(), await z.token.balanceOf(await z.lottery.getAddress()), await z.lottery.drawEvidence(1)]; }

describe('post-manual authenticated late VRF callback', function () {
  it('cannot mutate a finalized manual draw', async () => {
    const z = await fixture();
    await (await z.lottery.connect(z.player).buyTicket(ticketMask())).wait();
    await advance(z.provider, 604801); await (await z.lottery.closeRound(1)).wait(); await (await z.lottery.requestRandomness(1)).wait();
    const id = (await z.lottery.rounds(1)).requestId;
    await advance(z.provider, 259201);
    const receipt = await (await z.lottery.executeManualContingency(1, 77, ethers.id('timeout'), ethers.id('evidence'), { gasLimit: 500000n })).wait();
    console.log(`MANUAL_GAS estimate=128017 gasLimit=500000 gasUsed=${receipt.gasUsed}`);
    await (await z.lottery.processSettlement(1, 1)).wait();
    const before = await snapshot(z, id); assert.equal(before[4], 2n);
    await assert.rejects(z.coordinator.fulfill(id, 999).then((tx) => tx.wait()));
    assert.deepEqual(await snapshot(z, id), before);
  });
});

describe('delayed authenticated VRF callback', function () {
  it('settles only its original pending round after a substantial delay', async () => {
    const z = await fixture();
    await (await z.lottery.connect(z.player).buyTicket(ticketMask())).wait();
    await advance(z.provider, 604801);
    await (await z.lottery.closeRound(1)).wait();
    await (await z.lottery.requestRandomness(1)).wait();

    const requested = await z.lottery.rounds(1);
    const requestId = requested.requestId;
    const requestedAt = requested.requestedAt;
    const requestMapping = await z.lottery.requestIdToRoundId(requestId);
    const accountingBefore = {
      playerLiabilities: await z.lottery.playerLiabilities(),
      jackpotReserve: await z.lottery.jackpotReserve(),
      weeklyPool: requested.weeklyPool,
      maintenanceReserve: await z.lottery.maintenanceReserve(),
      oracleReserve: await z.lottery.oracleReserve(),
      unallocatedDustReserve: await z.lottery.unallocatedDustReserve(),
      tokenBalance: await z.token.balanceOf(await z.lottery.getAddress())
    };
    const unrelatedRoundBefore = await z.lottery.rounds(2);

    // Deliberately exceed the contingency window without invoking any recovery path.
    await advance(z.provider, 7 * 24 * 60 * 60 + 123);
    const pendingAfterDelay = await z.lottery.rounds(1);
    assert.equal(pendingAfterDelay.state, 2n, 'the delayed round must remain VRF_REQUESTED');
    assert.equal(pendingAfterDelay.requestPending, true);
    assert.equal(await z.lottery.requestIdToRoundId(requestId), 1n);

    await (await z.coordinator.fulfill(requestId, 123456789)).wait();
    const fulfillmentBlock = await z.provider.getBlock('latest');
    const fulfilled = await z.lottery.rounds(1);
    const evidenceAfterFulfillment = await z.lottery.drawEvidence(1);
    const delaySeconds = BigInt(fulfillmentBlock.timestamp) - requestedAt;

    assert.ok(delaySeconds >= 7n * 24n * 60n * 60n, 'callback must be substantially delayed');
    assert.equal(await z.lottery.requestIdToRoundId(requestId), requestMapping);
    assert.equal(fulfilled.state, 3n, 'authenticated callback must enter VRF_RECEIVED');
    assert.equal(fulfilled.drawMethod, 1n, 'draw method must be CHAINLINK_VRF');
    assert.equal(fulfilled.requestPending, false);
    assert.notEqual(fulfilled.winningMask, 0n);
    assert.equal(evidenceAfterFulfillment[0], 1n);
    assert.equal(evidenceAfterFulfillment[2], requestId);
    assert.equal(evidenceAfterFulfillment[3].toLowerCase(), (await z.coordinator.getAddress()).toLowerCase());
    assert.equal(evidenceAfterFulfillment[5], requestedAt);
    assert.equal(evidenceAfterFulfillment[10], ethers.ZeroHash);
    assert.equal(evidenceAfterFulfillment[11], ethers.ZeroHash);

    // Fulfillment only records the draw. It must not manufacture accounting changes.
    assert.equal(await z.lottery.playerLiabilities(), accountingBefore.playerLiabilities);
    assert.equal(await z.lottery.jackpotReserve(), accountingBefore.jackpotReserve);
    assert.equal((await z.lottery.rounds(1)).weeklyPool, accountingBefore.weeklyPool);
    assert.equal(await z.lottery.maintenanceReserve(), accountingBefore.maintenanceReserve);
    assert.equal(await z.lottery.oracleReserve(), accountingBefore.oracleReserve);
    assert.equal(await z.lottery.unallocatedDustReserve(), accountingBefore.unallocatedDustReserve);
    assert.equal(await z.token.balanceOf(await z.lottery.getAddress()), accountingBefore.tokenBalance);

    await (await z.lottery.processSettlement(1, 1)).wait();
    const settled = await z.lottery.rounds(1);
    const expectedAward = accountingBefore.weeklyPool + (settled.bestScore === 15n ? accountingBefore.jackpotReserve : 0n);
    const expectedJackpot = settled.bestScore === 15n ? 0n : accountingBefore.jackpotReserve;
    const accountingAfter = {
      playerLiabilities: await z.lottery.playerLiabilities(),
      jackpotReserve: await z.lottery.jackpotReserve(),
      weeklyPool: settled.weeklyPool,
      maintenanceReserve: await z.lottery.maintenanceReserve(),
      oracleReserve: await z.lottery.oracleReserve(),
      unallocatedDustReserve: await z.lottery.unallocatedDustReserve(),
      tokenBalance: await z.token.balanceOf(await z.lottery.getAddress())
    };

    assert.equal(settled.state, 5n, 'settlement must finalize the requested round');
    assert.equal(settled.finalistCount, 1n);
    assert.equal(settled.totalAward, expectedAward);
    assert.equal(accountingAfter.playerLiabilities, accountingBefore.playerLiabilities + expectedAward);
    assert.equal(accountingAfter.jackpotReserve, expectedJackpot);
    assert.equal(accountingAfter.weeklyPool, 0n);
    assert.equal(accountingAfter.maintenanceReserve, accountingBefore.maintenanceReserve);
    assert.equal(accountingAfter.oracleReserve, accountingBefore.oracleReserve);
    assert.equal(accountingAfter.unallocatedDustReserve, accountingBefore.unallocatedDustReserve);
    assert.equal(accountingAfter.tokenBalance, accountingBefore.tokenBalance);
    assert.equal(
      accountingAfter.playerLiabilities + accountingAfter.jackpotReserve + accountingAfter.maintenanceReserve + accountingAfter.oracleReserve + accountingAfter.unallocatedDustReserve,
      accountingAfter.tokenBalance,
      'independent reserve and liability accounting must conserve the lottery balance'
    );
    assert.equal(await z.lottery.currentRoundId(), 1n, 'delayed callback must not advance another round');
    assert.deepEqual(await z.lottery.rounds(2), unrelatedRoundBefore, 'no unrelated round may mutate');

    const immutableAfterSettlement = await snapshot(z, requestId);
    await assert.rejects(z.coordinator.fulfill(requestId, 999).then((tx) => tx.wait()));
    assert.deepEqual(await snapshot(z, requestId), immutableAfterSettlement, 'a repeated callback cannot create a second draw or liability');

    console.log(`DELAYED_VRF requestedAt=${requestedAt} fulfillmentTimestamp=${fulfillmentBlock.timestamp} delaySeconds=${delaySeconds}`);
  });
});

async function completedRoundSnapshot(z, requestId) {
  const round = await z.lottery.rounds(1);
  return {
    roundId: 1n,
    requestId,
    requestMapping: await z.lottery.requestIdToRoundId(requestId),
    state: round.state,
    openedAt: round.openedAt,
    cutoffAt: round.cutoffAt,
    closedAt: round.closedAt,
    requestedAt: round.requestedAt,
    completedAt: round.completedAt,
    ticketStart: round.ticketStart,
    ticketCount: round.ticketCount,
    settlementCursor: round.settlementCursor,
    requestPending: round.requestPending,
    winningMask: round.winningMask,
    drawMethod: round.drawMethod,
    bestScore: round.bestScore,
    finalistCount: round.finalistCount,
    totalAward: round.totalAward,
    weeklyPool: round.weeklyPool,
    drawEvidence: Array.from(await z.lottery.drawEvidence(1)),
    playerLiabilities: await z.lottery.playerLiabilities(),
    jackpotReserve: await z.lottery.jackpotReserve(),
    maintenanceReserve: await z.lottery.maintenanceReserve(),
    oracleReserve: await z.lottery.oracleReserve(),
    unallocatedDustReserve: await z.lottery.unallocatedDustReserve(),
    tokenBalance: await z.token.balanceOf(await z.lottery.getAddress())
  };
}

describe('authenticated callback after completed VRF round', function () {
  it('rejects a duplicate callback without mutating completed draw evidence or accounting', async () => {
    const z = await fixture();
    await (await z.lottery.connect(z.player).buyTicket(ticketMask())).wait();
    await advance(z.provider, 604801);
    await (await z.lottery.closeRound(1)).wait();
    await (await z.lottery.requestRandomness(1)).wait();

    const requestId = (await z.lottery.rounds(1)).requestId;
    await (await z.coordinator.fulfill(requestId, 987654321)).wait();
    await (await z.lottery.processSettlement(1, 1)).wait();

    const before = await completedRoundSnapshot(z, requestId);
    assert.equal(before.state, 5n, 'round A must be completed before the duplicate callback');
    assert.equal(before.drawMethod, 1n, 'round A must use CHAINLINK_VRF');
    assert.equal(before.requestMapping, 1n);
    assert.equal(before.requestPending, false);
    assert.equal(before.settlementCursor, before.ticketCount);
    assert.notEqual(before.winningMask, 0n);
    assert.equal(before.drawEvidence[0], 1n);
    assert.equal(before.drawEvidence[2], requestId);
    assert.ok(before.totalAward > 0n, 'completed settlement must establish the prize liability');
    assert.ok(before.playerLiabilities > 0n, 'completed settlement must establish player liabilities');

    // This is the constructor-bound coordinator, not an unauthorized-caller substitute.
    await assert.rejects(z.coordinator.fulfill(requestId, 111).then((tx) => tx.wait()));
    const after = await completedRoundSnapshot(z, requestId);

    assert.deepEqual(after, before, 'an authenticated duplicate callback must be entirely neutralized');
  });
});

describe('request-time hostile VRF coordinator reentrancy', function () {
  it('cannot corrupt a staged request before its requestId mapping exists', async () => {
    const z = await hostileRequestFixture();
    await (await z.coordinator.setAttackEnabled(true)).wait();
    await (await z.lottery.connect(z.player).buyTicket(ticketMask())).wait();
    await advance(z.provider, 604801);
    await (await z.lottery.closeRound(1)).wait();

    const beforeRequest = {
      playerLiabilities: await z.lottery.playerLiabilities(),
      jackpotReserve: await z.lottery.jackpotReserve(),
      weeklyPool: (await z.lottery.rounds(1)).weeklyPool,
      maintenanceReserve: await z.lottery.maintenanceReserve(),
      oracleReserve: await z.lottery.oracleReserve(),
      unallocatedDustReserve: await z.lottery.unallocatedDustReserve(),
      tokenBalance: await z.token.balanceOf(await z.lottery.getAddress())
    };

    await (await z.lottery.requestRandomness(1)).wait();
    const staged = await z.lottery.rounds(1);
    const requestId = staged.requestId;
    const evidence = await z.lottery.drawEvidence(1);

    assert.equal(await z.coordinator.reentrancyAttempted(), true);
    assert.equal(await z.coordinator.observedState(), 2n, 'state is staged as VRF_REQUESTED before the external call');
    assert.equal(await z.coordinator.observedRequestPending(), true, 'requestPending is staged before the external call');
    assert.equal(await z.coordinator.observedRequestId(), 0n, 'the returned requestId is unavailable during the external call');
    assert.equal(await z.coordinator.observedRequestMapping(), 0n, 'no mapping exists for the prospective request during the external call');
    for (const operation of [
      'requestReentrySucceeded', 'manualReentrySucceeded', 'settlementReentrySucceeded',
      'callbackReentrySucceeded', 'closeReentrySucceeded', 'openNextReentrySucceeded'
    ]) {
      assert.equal(await z.coordinator[operation](), false, `${operation} must be rejected`);
    }
    for (const dataName of [
      'requestReentryRevertData', 'manualReentryRevertData', 'settlementReentryRevertData',
      'callbackReentryRevertData', 'closeReentryRevertData', 'openNextReentryRevertData'
    ]) {
      assert.ok((await z.coordinator[dataName]()).length > 2, `${dataName} must record the rejection`);
    }

    assert.equal(await z.coordinator.requestCount(), 1n, 'only one coordinator request may be created');
    assert.equal(requestId, 1n);
    assert.equal(await z.lottery.requestIdToRoundId(requestId), 1n);
    assert.equal(staged.state, 2n);
    assert.equal(staged.requestPending, true);
    assert.equal(staged.drawMethod, 0n);
    assert.equal(staged.winningMask, 0n);
    assert.equal(evidence[0], 0n, 'no draw method is recorded before fulfillment');
    assert.equal(evidence[1], 0n, 'no winning result is recorded before fulfillment');
    assert.equal(evidence[6], 0n, 'no completion evidence is recorded before fulfillment');
    assert.equal(await z.lottery.playerLiabilities(), beforeRequest.playerLiabilities);
    assert.equal(await z.lottery.jackpotReserve(), beforeRequest.jackpotReserve);
    assert.equal((await z.lottery.rounds(1)).weeklyPool, beforeRequest.weeklyPool);
    assert.equal(await z.lottery.maintenanceReserve(), beforeRequest.maintenanceReserve);
    assert.equal(await z.lottery.oracleReserve(), beforeRequest.oracleReserve);
    assert.equal(await z.lottery.unallocatedDustReserve(), beforeRequest.unallocatedDustReserve);
    assert.equal(await z.token.balanceOf(await z.lottery.getAddress()), beforeRequest.tokenBalance);

    await (await z.coordinator.fulfill(requestId, 246813579)).wait();
    assert.equal((await z.lottery.rounds(1)).drawMethod, 1n, 'the legitimate returned request can still fulfill normally');
    await (await z.lottery.processSettlement(1, 1)).wait();
    const completed = await z.lottery.rounds(1);
    assert.equal(completed.state, 5n, 'the round can still finalize normally after the attack');
    assert.ok(completed.totalAward > 0n);
    assert.equal(await z.lottery.playerLiabilities(), completed.totalAward, 'only normal settlement establishes the prize liability');
  });
});

async function roundHistorySnapshot(z, roundId, requestId) {
  const round = await z.lottery.rounds(roundId);
  return {
    roundId: BigInt(roundId),
    requestId,
    requestMapping: await z.lottery.requestIdToRoundId(requestId),
    state: round.state,
    requestedAt: round.requestedAt,
    completedAt: round.completedAt,
    settlementCursor: round.settlementCursor,
    ticketCount: round.ticketCount,
    requestPending: round.requestPending,
    winningMask: round.winningMask,
    drawMethod: round.drawMethod,
    bestScore: round.bestScore,
    finalistCount: round.finalistCount,
    totalAward: round.totalAward,
    weeklyPool: round.weeklyPool,
    drawEvidence: Array.from(await z.lottery.drawEvidence(roundId))
  };
}

async function accountingSnapshot(z) {
  return {
    playerLiabilities: await z.lottery.playerLiabilities(),
    jackpotReserve: await z.lottery.jackpotReserve(),
    maintenanceReserve: await z.lottery.maintenanceReserve(),
    oracleReserve: await z.lottery.oracleReserve(),
    unallocatedDustReserve: await z.lottery.unallocatedDustReserve(),
    tokenBalance: await z.token.balanceOf(await z.lottery.getAddress())
  };
}

describe('hostile VRF cross-round isolation', function () {
  it('keeps request results permanently isolated by their mapped rounds', async () => {
    const z = await hostileRequestFixture();

    // Round A: legitimate request, fulfillment, and complete settlement.
    await (await z.lottery.connect(z.player).buyTicket(ticketMask())).wait();
    await advance(z.provider, 604801);
    await (await z.lottery.closeRound(1)).wait();
    await (await z.lottery.requestRandomness(1)).wait();
    const requestA = (await z.lottery.rounds(1)).requestId;
    await (await z.coordinator.fulfill(requestA, 13579)).wait();
    await (await z.lottery.processSettlement(1, 1)).wait();
    const roundACompleted = await roundHistorySnapshot(z, 1, requestA);
    assert.equal(roundACompleted.state, 5n);
    assert.equal(roundACompleted.drawMethod, 1n);
    assert.ok(roundACompleted.totalAward > 0n);

    // Round B obtains its own distinct pending request while A remains historical.
    await (await z.lottery.openNextRound()).wait();
    await (await z.lottery.connect(z.player).buyTicket(ticketMask())).wait();
    await advance(z.provider, 604801);
    await (await z.lottery.closeRound(2)).wait();
    await (await z.lottery.requestRandomness(2)).wait();
    const requestB = (await z.lottery.rounds(2)).requestId;
    const roundABeforeAttacks = await roundHistorySnapshot(z, 1, requestA);
    const roundBBeforeAttacks = await roundHistorySnapshot(z, 2, requestB);
    const accountingBeforeAttacks = await accountingSnapshot(z);

    assert.notEqual(requestA, requestB);
    assert.equal(await z.lottery.requestIdToRoundId(requestA), 1n);
    assert.equal(await z.lottery.requestIdToRoundId(requestB), 2n);
    assert.equal(roundBBeforeAttacks.state, 2n);
    assert.equal(roundBBeforeAttacks.requestPending, true);
    assert.equal(roundBBeforeAttacks.drawMethod, 0n);
    assert.equal(roundBBeforeAttacks.winningMask, 0n);

    // The authenticated coordinator cannot reuse A or an unknown ID while B is pending.
    await assert.rejects(z.coordinator.fulfill(requestA, 24680).then((tx) => tx.wait()));
    await assert.rejects(z.coordinator.fulfill(999999, 24680).then((tx) => tx.wait()));
    assert.deepEqual(await roundHistorySnapshot(z, 1, requestA), roundABeforeAttacks);
    assert.deepEqual(await roundHistorySnapshot(z, 2, requestB), roundBBeforeAttacks);
    assert.deepEqual(await accountingSnapshot(z), accountingBeforeAttacks);
    assert.equal(await z.lottery.requestIdToRoundId(requestA), 1n);
    assert.equal(await z.lottery.requestIdToRoundId(requestB), 2n);

    // Request B can only complete B. Round A is rechecked after B's normal lifecycle.
    await (await z.coordinator.fulfill(requestB, 112233)).wait();
    assert.equal((await z.lottery.rounds(2)).drawMethod, 1n);
    await (await z.lottery.processSettlement(2, 1)).wait();
    const roundBAfterCompletion = await roundHistorySnapshot(z, 2, requestB);
    const accountingAfterB = await accountingSnapshot(z);
    const expectedAwardB = roundBBeforeAttacks.weeklyPool + (roundBAfterCompletion.bestScore === 15n ? accountingBeforeAttacks.jackpotReserve : 0n);
    const expectedJackpotB = roundBAfterCompletion.bestScore === 15n ? 0n : accountingBeforeAttacks.jackpotReserve;

    assert.deepEqual(await roundHistorySnapshot(z, 1, requestA), roundABeforeAttacks);
    assert.equal(roundBAfterCompletion.state, 5n);
    assert.equal(roundBAfterCompletion.drawMethod, 1n);
    assert.equal(roundBAfterCompletion.totalAward, expectedAwardB);
    assert.equal(accountingAfterB.playerLiabilities, accountingBeforeAttacks.playerLiabilities + expectedAwardB);
    assert.equal(accountingAfterB.jackpotReserve, expectedJackpotB);
    assert.equal(accountingAfterB.maintenanceReserve, accountingBeforeAttacks.maintenanceReserve);
    assert.equal(accountingAfterB.oracleReserve, accountingBeforeAttacks.oracleReserve);
    assert.equal(accountingAfterB.unallocatedDustReserve, accountingBeforeAttacks.unallocatedDustReserve);
    assert.equal(accountingAfterB.tokenBalance, accountingBeforeAttacks.tokenBalance);

    const immutableAfterB = await roundHistorySnapshot(z, 2, requestB);
    const accountingAfterBImmutable = await accountingSnapshot(z);
    await assert.rejects(z.coordinator.fulfill(requestB, 445566).then((tx) => tx.wait()));
    assert.deepEqual(await roundHistorySnapshot(z, 1, requestA), roundABeforeAttacks);
    assert.deepEqual(await roundHistorySnapshot(z, 2, requestB), immutableAfterB);
    assert.deepEqual(await accountingSnapshot(z), accountingAfterBImmutable);
  });
});

