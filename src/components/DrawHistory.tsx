import { useEffect, useState } from 'react';
import { CHAINS } from '../config/chains';
import type { ChainKey } from '../types';
import { readDrawPage, type DrawEvent, type DrawPage } from '../web3/events';

type State = Partial<Record<ChainKey, DrawPage>>;
const formatTime = (timestamp: number) => timestamp ? new Date(timestamp * 1000).toLocaleString() : 'Block timestamp unavailable';
export function DrawHistory({ refreshKey }: { refreshKey: number }) {
  const [pages, setPages] = useState<State>({});
  useEffect(() => { let cancelled = false; Promise.all(Object.values(CHAINS).map(async (chain) => [chain.key, await readDrawPage(chain)] as const)).then((rows) => { if (!cancelled) setPages(Object.fromEntries(rows)); }); return () => { cancelled = true; }; }, [refreshKey]);
  const draws = Object.values(pages).flatMap((page) => page?.draws ?? []).sort((a, b) => b.timestamp - a.timestamp);
  return <section id="draws" className="draw-history panel"><p className="eyebrow">DRAW HISTORY</p><h2>Verified draw events</h2><p className="data-limitation">Events are queried only from audited deployment blocks, in 2,000-block chunks. Each initial read is a bounded 50,000-block page; no block-0 scan is performed.</p>{draws.length ? <div className="winner-records">{draws.map((draw: DrawEvent) => <article key={`${draw.chain.key}-${draw.transactionHash}`}><b>{draw.chain.name}</b><strong>Request ID: {draw.requestId.toString()}</strong><span>Winning numbers: {draw.numbers.map((number) => String(number).padStart(2, '0')).join(' · ') || 'No valid numbers decoded'}</span><span>Mask: {draw.mask.toString()} · Block {draw.blockNumber}</span><a href={`${draw.chain.explorer}/tx/${draw.transactionHash}`} target="_blank" rel="noreferrer">{formatTime(draw.timestamp)} · View transaction ↗</a></article>)}</div> : <p className="empty">No draw event is available in the current bounded scan.</p>}<div className="draw-health">{Object.values(CHAINS).map((chain) => <span key={chain.key}>{chain.name}: {pages[chain.key]?.error ? 'RPC unavailable / retry' : pages[chain.key]?.complete ? 'scan complete' : pages[chain.key] ? 'more audited blocks available' : 'reading…'}</span>)}</div></section>;
}
