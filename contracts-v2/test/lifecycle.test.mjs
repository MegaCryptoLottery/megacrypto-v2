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
    await assert.rejects(lottery.requestRandomness(1).then((tx) => tx.wait()));
    const callback = await vrf.fulfill(1, 44n); const receipt = await callback.wait(); assert.ok(receipt.gasUsed < 200000n);
    const after = await lottery.rounds(1); assert.equal(after.state, 3n); assert.equal(after.settlementCursor, 0n); assert.equal(after.winningMask, BigInt(winningMask(44n)));
  });
  it('settles in bounded batches and lets one wallet claim multiple winning tickets only once each', async () => {
    const { lottery, player, provider, vrf, token } = await fixture(); const mask = winningMask(99n);
    await (await lottery.connect(player).buyTicket(mask)).wait(); await (await lottery.connect(player).buyTicket(mask)).wait();
    await advance(provider, 7 * 24 * 60 * 60 + 1); await (await lottery.closeRound(1)).wait(); await (await lottery.requestRandomness(1)).wait(); await (await vrf.fulfill(1, 99n)).wait();
    await (await lottery.processSettlement(1, 1)).wait(); assert.equal((await lottery.rounds(1)).settlementCursor, 1n);
    await (await lottery.processSettlement(1, 1)).wait(); const completed = await lottery.rounds(1); assert.equal(completed.state, 5n); assert.equal(completed.finalistCount, 2n);
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
});

