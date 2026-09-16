import assert from 'node:assert/strict';
import { fixture, ticketMask, advance } from './helpers.mjs';

describe('bounded settlement gas measurements', function () {
  it('records bounded settlement gas at 1, 10, and 100 local tickets', async () => {
    for (const count of [1, 10, 100]) {
      const { lottery, player, provider, vrf } = await fixture();
      for (let i = 0; i < count; i++) await (await lottery.connect(player).buyTicket(ticketMask(Array.from({ length: 15 }, (_, n) => ((n + i) % 25) + 1)))).wait();
      await advance(provider, 7 * 24 * 60 * 60 + 1); await (await lottery.closeRound(1)).wait(); await (await lottery.requestRandomness(1)).wait(); await (await vrf.fulfill(1, 777n)).wait();
      const gas = await lottery.processSettlement.estimateGas(1, 1); assert.ok(gas < 400000n, `batch gas too high for ${count} tickets: ${gas}`);
    }
  });
});

