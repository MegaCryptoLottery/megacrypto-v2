import assert from 'node:assert/strict';
import { fixture, ticketMask, advance } from './helpers.mjs';

describe('property and invariant checks', function () {
  it('keeps frozen ticket counts, unique request mapping, and solvency across randomized ticket sets', async () => {
    for (let run = 0; run < 12; run++) {
      const { lottery, player, provider, vrf } = await fixture(); const count = 1 + (run % 3);
      for (let i = 0; i < count; i++) await (await lottery.connect(player).buyTicket(ticketMask(Array.from({ length: 15 }, (_, n) => ((n + i) % 25) + 1)))).wait();
      await advance(provider, 7 * 24 * 60 * 60 + 1); await (await lottery.closeRound(1)).wait(); const frozen = (await lottery.rounds(1)).ticketCount;
      await (await lottery.requestRandomness(1)).wait(); assert.equal(await lottery.requestIdToRoundId(1), 1n); await (await vrf.fulfill(1, BigInt(run + 1))).wait();
      while ((await lottery.rounds(1)).settlementCursor < frozen) await (await lottery.processSettlement(1, 3)).wait();
      const [balance, protected_, solvent] = await lottery.solvency(); assert.ok(balance >= protected_); assert.equal(solvent, true); assert.equal((await lottery.rounds(1)).ticketCount, frozen);
    }
  });
});

