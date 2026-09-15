import { describe, expect, it } from 'vitest';
import { formatUsdt, normalizeUsdt } from './amounts';
import { maskToNumbers, CURRENT_BET_SCAN_LIMIT, WINNER_HISTORY_LIMIT } from './player';

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
  it('decodes the contract mask bits 0–24 into ticket numbers 1–25', () => {
    expect(maskToNumbers((1n << 0n) | (1n << 4n) | (1n << 24n))).toEqual([1, 5, 25]);
  });

  it('keeps read ranges explicitly bounded', () => {
    expect(CURRENT_BET_SCAN_LIMIT).toBe(500);
    expect(WINNER_HISTORY_LIMIT).toBe(100);
  });
});
