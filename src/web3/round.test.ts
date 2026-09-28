import { describe, expect, it } from 'vitest';
import { cutoffCountdown, roundLifecycle } from './round';

describe('contract-authoritative round presentation', () => {
  const now = Date.UTC(2026, 8, 28, 12, 0, 0);
  it('does not offer tickets once an open round has a due cutoff and checkUpkeep reports CLOSE', () => {
    expect(roundLifecycle(0, new Date(now - 1), 'CLOSE', now)).toEqual({ label: 'DRAW PROCESSING', detail: 'Waiting for CLOSE' });
  });
  it('labels each on-chain lifecycle state without deriving a local schedule', () => {
    expect(roundLifecycle(1, undefined, 'REQUEST', now).label).toBe('DRAW PROCESSING');
    expect(roundLifecycle(2, undefined, undefined, now).label).toBe('WAITING FOR RANDOMNESS');
    expect(roundLifecycle(3, undefined, 'SETTLE', now).label).toBe('CALCULATING WINNERS');
    expect(roundLifecycle(5, undefined, 'OPEN_NEXT', now).label).toBe('NEXT ROUND OPENING');
  });
  it('counts only down to the stored contract cutoff and never below zero', () => {
    expect(cutoffCountdown(new Date(now + 90_061_000), now)).toBe('01 : 01 : 01 : 01');
    expect(cutoffCountdown(new Date(now - 1), now)).toBe('00 : 00 : 00 : 00');
  });
});
