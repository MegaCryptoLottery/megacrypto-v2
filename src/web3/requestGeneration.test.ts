import { describe, expect, it } from 'vitest';
import { RequestGeneration } from './requestGeneration';

describe('RequestGeneration', () => {
  it('ignores an old network response after a switch', () => {
    const guard = new RequestGeneration();
    const polygon = guard.begin();
    const bnb = guard.begin();
    expect(guard.isCurrent(polygon)).toBe(false);
    expect(guard.isCurrent(bnb)).toBe(true);
  });

  it('also ignores an old network error after a switch', () => {
    const guard = new RequestGeneration();
    const oldRequest = guard.begin();
    guard.begin();
    expect(guard.isCurrent(oldRequest)).toBe(false);
  });

  it('invalidates a request during disconnect and accepts only a reconnect request', () => {
    const guard = new RequestGeneration();
    const beforeDisconnect = guard.begin();
    guard.invalidate();
    const reconnect = guard.begin();
    expect(guard.isCurrent(beforeDisconnect)).toBe(false);
    expect(guard.isCurrent(reconnect)).toBe(true);
  });
});
