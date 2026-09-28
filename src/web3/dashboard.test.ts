import { describe, expect, it } from 'vitest';
import { CHAINS } from '../config/chains';
import { aggregateNetworkPrizes, type NetworkPrizeState } from './dashboard';

describe('global prize aggregation', () => {
  it('uses only successful canonical reads and never silently counts a failed RPC', () => {
    const live = (chain: NetworkPrizeState['chain'], jackpotUsdt: bigint): NetworkPrizeState => ({ chain, jackpotUsdt, weeklyUsdt: 1_900_000n, lastAttempt: 1, status: 'live' });
    const failed: NetworkPrizeState = { chain: CHAINS.base, lastAttempt: 1, status: 'error', error: 'timeout' };
    const totals = aggregateNetworkPrizes([live(CHAINS.polygon, 17_500_000n), live(CHAINS.bsc, 2_500_000n), failed]);
    expect(totals).toEqual({ available: 2, jackpot: 20_000_000n, weekly: 3_800_000n });
  });
});
