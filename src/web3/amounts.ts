import { formatUnits } from 'ethers';

export const USDT_DISPLAY_DECIMALS = 6;

export const normalizeUsdt = (value: bigint, sourceDecimals: number) => sourceDecimals >= USDT_DISPLAY_DECIMALS
  ? value / 10n ** BigInt(sourceDecimals - USDT_DISPLAY_DECIMALS)
  : value * 10n ** BigInt(USDT_DISPLAY_DECIMALS - sourceDecimals);

export const formatNormalizedUsdt = (value: bigint | undefined, maximumFractionDigits = 4, minimumFractionDigits = 0) => value === undefined
  ? '—'
  : Number(formatUnits(value, USDT_DISPLAY_DECIMALS)).toLocaleString(undefined, { maximumFractionDigits, minimumFractionDigits });

export const formatUsdt = (value: bigint | undefined, sourceDecimals = USDT_DISPLAY_DECIMALS, maximumFractionDigits = 4) => value === undefined
  ? '—'
  : formatNormalizedUsdt(normalizeUsdt(value, sourceDecimals), maximumFractionDigits);
