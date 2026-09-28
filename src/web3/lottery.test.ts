import { AbiCoder } from 'ethers';
import { describe, expect, it } from 'vitest';
import { decodeUpkeepAction } from './lottery';

describe('checkUpkeep action decoding', () => {
  it('uses contract performData rather than a client-side calendar guess', () => {
    const encode = (action: number) => AbiCoder.defaultAbiCoder().encode(['uint256', 'uint8', 'uint256'], [1n, action, 0n]);
    expect(decodeUpkeepAction(true, encode(0))).toBe('CLOSE');
    expect(decodeUpkeepAction(true, encode(1))).toBe('REQUEST');
    expect(decodeUpkeepAction(true, encode(2))).toBe('SETTLE');
    expect(decodeUpkeepAction(true, encode(3))).toBe('OPEN_NEXT');
  });
  it('does not manufacture an action when upkeep is not needed', () => {
    expect(decodeUpkeepAction(false, '0x')).toBeUndefined();
  });
});
