import { useEffect, useState } from 'react';
import { formatUnits } from 'ethers';
import { readGlobalPrizes, type NetworkPrizeState } from '../web3/dashboard';
const display = (value?: bigint) => value === undefined ? '—' : Number(formatUnits(value, 6)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export function GlobalPrizeDashboard() {
  const [data, setData] = useState<{ jackpot: bigint; weekly: bigint; available: number; networks: NetworkPrizeState[] }>(); const [loading, setLoading] = useState(true);
  const refresh = async () => { setLoading(true); setData(await readGlobalPrizes()); setLoading(false); };
  useEffect(() => { void refresh(); }, []);
  return <section className="global-prizes panel"><div className="section-heading"><div><p className="eyebrow">LIVE MULTI-CHAIN PRIZES</p><h2>Across all verified networks</h2></div><button className="secondary refresh" onClick={refresh} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh'}</button></div><div className="prize-totals"><div><span>Global jackpot</span><strong>{data ? `$${display(data.jackpot)}` : 'Loading…'} <small>USDT</small></strong></div><div><span>This week’s prizes</span><strong>{data ? `$${display(data.weekly)}` : 'Loading…'} <small>USDT</small></strong></div></div><p className={data?.available === 6 ? 'availability ok' : 'availability'}>{data ? `${data.available} of 6 networks available${data.available === 6 ? '' : ' · Aggregate is partial'}` : 'Reading each network independently…'}</p>{data && <details><summary>Per-network breakdown</summary><div className="prize-table"><b>Network</b><b>Jackpot</b><b>Weekly pool</b><b>Status</b>{data.networks.map(item => <><span key={`${item.chain.key}-name`}>{item.chain.name}</span><span key={`${item.chain.key}-jackpot`}>{display(item.jackpot)}</span><span key={`${item.chain.key}-weekly`}>{display(item.weekly)}</span><span key={`${item.chain.key}-status`} className={item.error ? 'down' : 'up'}>{item.error ? 'Unavailable' : 'Live'}</span></>)}</div></details>}</section>;
}

