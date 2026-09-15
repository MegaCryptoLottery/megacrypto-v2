import { useEffect, useMemo, useState } from 'react';
import { CHAINS } from '../config/chains';
import type { ChainKey } from '../types';
import { formatUsdt, normalizeUsdt } from '../web3/amounts';
import { readWinnerHistory, type WinnerRecord } from '../web3/player';

type WinnerResult = { total: number; scanned: number; winners: WinnerRecord[]; error?: string };
const short = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`;
const dateFromContract = (value: bigint) => {
  const milliseconds = Number(value) * 1000;
  return Number.isSafeInteger(milliseconds) && milliseconds > Date.UTC(2000, 0, 1) && milliseconds <= Date.now() + 86_400_000
    ? new Date(milliseconds).toLocaleString()
    : `Contract timestamp: ${value.toString()}`;
};

export function WinnerHistory({ refreshKey }: { refreshKey: number }) {
  const [results, setResults] = useState<Partial<Record<ChainKey, WinnerResult>>>({});
  const [filter, setFilter] = useState<'all' | ChainKey>('all');
  useEffect(() => {
    let cancelled = false;
    Promise.all(Object.values(CHAINS).map(async (chain) => {
      try { return [chain.key, await readWinnerHistory(chain)] as const; }
      catch (error) { return [chain.key, { total: 0, scanned: 0, winners: [], error: error instanceof Error ? error.message : 'RPC unavailable' }] as const; }
    })).then((next) => { if (!cancelled) setResults(Object.fromEntries(next)); });
    return () => { cancelled = true; };
  }, [refreshKey]);
  const records = useMemo(() => Object.entries(results).flatMap(([key, result]) => result?.winners ?? []).filter((winner) => filter === 'all' || winner.chain.key === filter).sort((a, b) => Number(b.timestamp - a.timestamp)), [filter, results]);
  const normalizedRecorded = useMemo(() => records.reduce((sum, winner) => sum + normalizeUsdt(winner.amount, winner.chain.contracts.tokenDecimals), 0n), [records]);
  const scanned = Object.values(results).reduce((sum, result) => sum + (result?.scanned ?? 0), 0);
  return <section id="winners" className="winner-history panel" aria-label="Recorded winners">
    <div className="history-heading"><div><p className="eyebrow">RECORDED WINNERS</p><h2>Latest on-chain prize records</h2><p className="data-limitation">Recorded prizes cover the latest {scanned} getter records read (maximum 100 per network), not an asserted lifetime total.</p></div><label>Network<select value={filter} onChange={(event) => setFilter(event.target.value as 'all' | ChainKey)}><option value="all">All networks</option>{Object.values(CHAINS).map((chain) => <option key={chain.key} value={chain.key}>{chain.name}</option>)}</select></label></div>
    <p className="recorded-prizes"><span>RECORDED PRIZES · BOUNDED HISTORY</span><strong>{formatUsdt(normalizedRecorded, 6, 4)} USDT</strong></p>
    {records.length ? <div className="winner-records">{records.map((winner) => <article key={`${winner.chain.key}-${winner.index}`}><b>{winner.chain.name}</b><a href={`${winner.chain.explorer}/address/${winner.wallet}`} target="_blank" rel="noreferrer">{short(winner.wallet)} ↗</a><strong>{formatUsdt(winner.amount, winner.chain.contracts.tokenDecimals, 4)} USDT</strong><span>{winner.type || 'Contract prize type'} · {dateFromContract(winner.timestamp)}</span></article>)}</div> : <p className="empty">Winner history is currently unavailable from one or more RPCs. Retry live data.</p>}
  </section>;
}
