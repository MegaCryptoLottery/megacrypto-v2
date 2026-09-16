import assert from 'node:assert/strict';
import { ethers } from 'ethers';
import { fixture, ticketMask, winningMask, advance } from './helpers.mjs';

describe('MegaCryptoLotteryHardenedV2 lifecycle', function () {
  it('supports both 6 and 18 decimal USDT without changing ticket semantics', async () => {
    for (const decimals of [6, 18]) { const { lottery } = await fixture(decimals); assert.equal(await lottery.usdtDecimals(), BigInt(decimals)); assert.equal((await lottery.rounds(1)).ticketPrice, 5n * 10n ** BigInt(decimals)); }
  });
  it('rejects malformed tickets and closes ticket admission permanently at cutoff', async () => {
    const { lottery, player, provider } = await fixture();
    await assert.rejects(lottery.connect(player).buyTicket(ticketMask([1, 2, 3])));
    await (await lottery.connect(player).buyTicket(ticketMask())).wait();
    await advance(provider, 7 * 24 * 60 * 60 + 1);
    await (await lottery.closeRound(1)).wait();
    await assert.rejects(lottery.connect(player).buyTicket(ticketMask()));
    assert.equal((await lottery.rounds(1)).ticketCount, 1n);
  });
  it('binds a single request to its frozen round and uses a constant-cost callback', async () => {
    const { lottery, player, provider, vrf } = await fixture();
    await (await lottery.connect(player).buyTicket(ticketMask())).wait(); await advance(provider, 7 * 24 * 60 * 60 + 1); await (await lottery.closeRound(1)).wait();
    await (await lottery.requestRandomness(1)).wait(); const r = await lottery.rounds(1); assert.equal(r.requestId, 1n); assert.equal(await lottery.requestIdToRoundId(1), 1n);
    assert.equal(await vrf.lastExtraArgs(), ethers.id('VRF ExtraArgsV1').slice(0, 10) + ethers.zeroPadValue('0x01', 32).slice(2));
    await assert.rejects(lottery.requestRandomness(1).then((tx) => tx.wait()));
    const callback = await vrf.fulfill(1, 44n); const receipt = await callback.wait(); assert.ok(receipt.gasUsed < 200000n);
    const after = await lottery.rounds(1); assert.equal(after.state, 3n); assert.equal(after.settlementCursor, 0n); assert.equal(after.winningMask, BigInt(winningMask(44n)));
    assert.equal(after.drawMethod, 1n);
    const evidence = await lottery.drawEvidence(1); assert.equal(evidence.method, 1n); assert.equal(evidence.requestId, 1n); assert.equal(evidence.winningMask, BigInt(winningMask(44n)));
  });
  it('settles in bounded batches and lets one wallet claim multiple winning tickets only once each', async () => {
    const { lottery, player, provider, vrf, token } = await fixture(); const mask = winningMask(99n);
    await (await lottery.connect(player).buyTicket(mask)).wait(); await (await lottery.connect(player).buyTicket(mask)).wait();
    await advance(provider, 7 * 24 * 60 * 60 + 1); await (await lottery.closeRound(1)).wait(); await (await lottery.requestRandomness(1)).wait(); await (await vrf.fulfill(1, 99n)).wait();
    await (await lottery.processSettlement(1, 1)).wait(); assert.equal((await lottery.rounds(1)).settlementCursor, 1n);
    await (await lottery.processSettlement(1, 1)).wait(); const completed = await lottery.rounds(1); assert.equal(completed.state, 5n); assert.equal(completed.finalistCount, 2n);
    const entitlement = await lottery.ticketEntitlement(1, 0); assert.equal(entitlement.ticketOwner, await player.getAddress()); assert.equal(entitlement.winning, true); assert.equal(entitlement.claimableAmount, completed.totalAward / 2n); assert.equal(entitlement.claimed, false);
    const before = await token.balanceOf(await player.getAddress()); await (await lottery.connect(player).claim(1, 0)).wait(); await (await lottery.connect(player).claim(1, 1)).wait(); assert.ok((await token.balanceOf(await player.getAddress())) > before);
    await assert.rejects(lottery.connect(player).claim(1, 0));
  });
  it('does not allow arbitrary or premature migration and preserves claim liabilities', async () => {
    const { lottery, deploy, provider, owner } = await fixture(); const invalid = await deploy('mocks/MockMigrationReceiver.sol', 'InvalidMigrationReceiver'); await invalid.waitForDeployment();
    await assert.rejects(lottery.proposeMigration(await invalid.getAddress()));
    const receiver = await deploy('mocks/MockMigrationReceiver.sol', 'MockMigrationReceiver'); await receiver.waitForDeployment();
    await (await lottery.proposeMigration(await receiver.getAddress())).wait(); await assert.rejects(lottery.executeMigration());
    await advance(provider, 7 * 24 * 60 * 60 + 1); await assert.rejects(lottery.executeMigration()); // active OPEN round blocks migration
    assert.equal(await lottery.owner(), await owner.getAddress());
  });
  it('rejects attacker-selected huge settlement batches without advancing state', async () => {
    const { lottery, player, provider, vrf } = await fixture(); await (await lottery.connect(player).buyTicket(ticketMask())).wait(); await advance(provider, 7 * 24 * 60 * 60 + 1); await (await lottery.closeRound(1)).wait(); await (await lottery.requestRandomness(1)).wait(); await (await vrf.fulfill(1, 77n)).wait();
    await assert.rejects(lottery.processSettlement(1, 201).then((tx) => tx.wait())); assert.equal((await lottery.rounds(1)).settlementCursor, 0n);
  });
  it('preserves Manual Contingency as a permanent method and rejects late VRF overwrite', async () => {
    const { lottery, player, provider, vrf } = await fixture(); await (await lottery.connect(player).buyTicket(ticketMask())).wait(); await advance(provider, 7 * 24 * 60 * 60 + 1); await (await lottery.closeRound(1)).wait(); await (await lottery.requestRandomness(1)).wait();
    await advance(provider, 3 * 24 * 60 * 60 + 1); await (await lottery.executeManualContingency(1, 123n, ethers.id('incident'), ethers.id('evidence'), { gasLimit: 500000 })).wait(); const manual = await lottery.rounds(1); const savedMask = manual.winningMask;
    assert.equal(manual.drawMethod, 2n); await assert.rejects(vrf.fulfill(1, 999n).then((tx) => tx.wait())); assert.equal((await lottery.rounds(1)).winningMask, savedMask); assert.equal((await lottery.rounds(1)).drawMethod, 2n);
  });
  it('keeps an unclaimed historical jackpot liability claimable after a completed-round migration', async () => {
    const { lottery, player, provider, vrf, token, deploy } = await fixture(); const mask = winningMask(2026n);
    await (await lottery.connect(player).buyTicket(mask)).wait(); await advance(provider, 7 * 24 * 60 * 60 + 1); await (await lottery.closeRound(1)).wait(); await (await lottery.requestRandomness(1)).wait(); await (await vrf.fulfill(1, 2026n)).wait(); await (await lottery.processSettlement(1, 1)).wait();
    const liability = await lottery.playerLiabilities(); assert.equal(liability, 4400000n); await (await lottery.openNextRound()).wait(); await advance(provider, 7 * 24 * 60 * 60 + 1); await (await lottery.closeRound(2)).wait();
    const receiver = await deploy('mocks/MockMigrationReceiver.sol', 'MockMigrationReceiver'); await receiver.waitForDeployment(); await (await lottery.proposeMigration(await receiver.getAddress())).wait(); await advance(provider, 7 * 24 * 60 * 60 + 1); await (await lottery.executeMigration()).wait();
    assert.equal(await token.balanceOf(await lottery.getAddress()), liability); assert.equal(await token.balanceOf(await receiver.getAddress()), 600000n); const before = await token.balanceOf(await player.getAddress()); await (await lottery.connect(player).claim(1, 0)).wait(); assert.equal((await token.balanceOf(await player.getAddress())) - before, liability); await assert.rejects(lottery.connect(player).claim(1, 0).then((tx) => tx.wait()));
  });
});

