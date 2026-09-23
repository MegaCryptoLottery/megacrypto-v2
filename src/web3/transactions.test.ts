import { describe, expect, it } from 'vitest';
import { Interface } from 'ethers';
import { CHAINS } from '../config/chains';
import { LOTTERY_ABI } from '../contracts/lotteryAbi';
import { InsufficientUsdtBalanceError, assertPreparationNetwork, decidePurchaseAction, encodeTicketMask, formatTokenAmount, friendlyError, validateTicketNumbers } from './transactions';

const validTicket = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

describe('ticket preparation guards', () => {
  it('accepts exactly 15 unique in-range numbers and normalizes their order', () => {
    expect(validateTicketNumbers([...validTicket].reverse())).toEqual(validTicket);
  });

  it('rejects fewer than 15, duplicates, and numbers outside 1..25', () => {
    expect(() => validateTicketNumbers(validTicket.slice(0, 14))).toThrow(/exactly 15/i);
    expect(() => validateTicketNumbers([...validTicket.slice(0, 14), 14])).toThrow(/exactly 15/i);
    expect(() => validateTicketNumbers([...validTicket.slice(0, 14), 26])).toThrow(/exactly 15/i);
  });

  it('formats the same five-USDT price correctly for 6- and 18-decimal deployments', () => {
    expect(formatTokenAmount(5_000_000n, CHAINS.polygon.contracts.tokenDecimals)).toBe('5.00');
    expect(formatTokenAmount(5_000_000_000_000_000_000n, CHAINS.bsc.contracts.tokenDecimals)).toBe('5.00');
  });

  it('blocks preparation before either approval or purchase when USDT is insufficient', () => {
    try {
      decidePurchaseAction(5_000_000n, 4_990_000n, 0n, CHAINS.polygon);
      throw new Error('Expected insufficient balance error');
    } catch (error) {
      expect(error).toBeInstanceOf(InsufficientUsdtBalanceError);
      expect(friendlyError(error)).toContain('Required: 5.00 USDT');
    }
  });

  it('chooses an exact approval review only when allowance is below the live price', () => {
    expect(decidePurchaseAction(5_000_000n, 9_000_000n, 4_999_999n, CHAINS.polygon)).toBe('approval');
    expect(decidePurchaseAction(5_000_000_000_000_000_000n, 9_000_000_000_000_000_000n, 5_000_000_000_000_000_000n, CHAINS.bsc)).toBe('ticket');
  });

  it('requires the connected chain to match the selected deployment before review', () => {
    expect(() => assertPreparationNetwork(CHAINS.bsc.chainId, CHAINS.polygon)).toThrow(/network does not match/i);
  });

  it('encodes the production V2 1..25 ticket mask and buyTicket(uint32) calldata', () => {
    const displayed = validateTicketNumbers([...validTicket].reverse());
    const mask = encodeTicketMask(displayed);
    expect(mask).toBe((1n << 16n) - 2n);
    const iface = new Interface(LOTTERY_ABI);
    const decoded = iface.decodeFunctionData('buyTicket', iface.encodeFunctionData('buyTicket', [mask]));
    expect(decoded.mask).toBe(mask);
  });
});
