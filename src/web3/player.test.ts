import { describe, expect, it } from 'vitest';
import { formatUsdt, normalizeUsdt } from './amounts';
import { maskToNumbers, CURRENT_BET_SCAN_LIMIT, WINNER_HISTORY_LIMIT } from './player';
import { drawPageEnd, EVENT_SCAN_CHUNK_SIZE, EVENT_SCAN_CHUNKS_PER_PAGE } from './events';
import { CHAINS } from '../config/chains';

describe('verified lottery data formatting', () => {
  it('formats six-decimal selected-network jackpot and weekly pool', () => {
    expect(formatUsdt(17_500_000n, 6, 2)).toBe('17.5');
    expect(formatUsdt(9_500_000n, 6, 2)).toBe('9.5');
  });

  it('normalizes BNB 18-decimal values through the canonical path', () => {
    expect(formatUsdt(2_500_000_000_002_500_000n, 18, 2)).toBe('2.5');
    expect(normalizeUsdt(2_500_000_000_002_500_000n, 18)).toBe(2_500_000n);
  });

  it('keeps a selected pool distinct from a six-network aggregate', () => {
    const polygon = normalizeUsdt(17_500_000n, 6);
    const fiveNetworks = 5n * normalizeUsdt(2_500_000n, 6);
    expect(formatUsdt(polygon, 6, 2)).toBe('17.5');
    expect(formatUsdt(polygon + fiveNetworks, 6, 2)).toBe('30');
  });
});

describe('on-chain ticket reconstruction bounds', () => {
  it('decodes the verified contract mask bits 1–25 into ticket numbers 1–25', () => {
    expect(maskToNumbers((1n << 1n) | (1n << 5n) | (1n << 25n))).toEqual([1, 5, 25]);
  });

  it('keeps read ranges explicitly bounded', () => {
    expect(CURRENT_BET_SCAN_LIMIT).toBe(500);
    expect(WINNER_HISTORY_LIMIT).toBe(100);
  });

  it('uses the verified draw mask convention for a real Polygon draw', () => {
    expect(maskToNumbers(14_296_958n)).toEqual([1, 2, 3, 4, 5, 6, 8, 9, 10, 13, 17, 19, 20, 22, 23]);
  });

  it('pages draw scans in a fixed bounded range rather than from block zero', () => {
    expect(drawPageEnd(93_187_959, 94_000_000)).toBe(93_237_958);
    expect(EVENT_SCAN_CHUNK_SIZE).toBe(2_000);
    expect(EVENT_SCAN_CHUNKS_PER_PAGE).toBe(25);
  });

  it('configures only independently evidenced deployment blocks', () => {
    expect(CHAINS.polygon.contracts.deploymentStartBlock).toBe(93_187_959);
    expect(CHAINS.arbitrum.contracts.deploymentStartBlock).toBe(503_193_432);
    expect(CHAINS.base.contracts.deploymentStartBlock).toBe(51_106_590);
    expect(CHAINS.optimism.contracts.deploymentStartBlock).toBe(156_703_895);
    expect(CHAINS.avalanche.contracts.deploymentStartBlock).toBe(94_904_282);
    expect(CHAINS.bsc.contracts.deploymentStartBlock).toBeUndefined();
  });
});
