import type { ReactNode } from 'react';
import type { ChainKey } from '../types';

export function NetworkIcon({ chain, label }: { chain: ChainKey; label?: string }) {
  const marks: Record<ChainKey, ReactNode> = {
    polygon: <><path d="m8 13 5-3 5 3v6l-5 3-5-3v-6Z" /><path d="m18 13 5-3 5 3v6l-5 3-5-3" /></>,
    bsc: <><path d="m16 5 5 3-5 3-5-3 5-3Zm-7 5 5 3-5 3-5-3 5-3Zm14 0 5 3-5 3-5-3 5-3ZM16 15l5 3-5 3-5-3 5-3Zm-7 5 5 3-5 3-5-3 5-3Zm14 0 5 3-5 3-5-3 5-3Z" /></>,
    arbitrum: <><path d="m16 4 9 5v14l-9 5-9-5V9l9-5Z" /><path d="m12 21 5-12 3 7 3-5" /></>,
    base: <><circle cx="16" cy="16" r="11" /><path d="M8 16h12" /></>,
    optimism: <><path d="M8 21c-5-5-3-13 4-15 7-3 15 1 14 9-1 8-10 12-18 6Z" /><path d="M11 13h10M11 18h7" /></>,
    avalanche: <><path d="m16 5 9 18H7L16 5Zm0 8-2 5h4l-2-5Z" /></>,
  };
  return <svg className={`network-icon ${chain}`} viewBox="0 0 32 32" role="img" aria-label={label ?? chain}>{marks[chain]}</svg>;
}

