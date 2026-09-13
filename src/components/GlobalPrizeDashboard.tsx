import { useEffect, useState } from 'react';
import { formatUnits } from 'ethers';
import { readGlobalPrizes, type NetworkPrizeState } from '../web3/dashboard';
import { TrophyMark } from './TrophyMark';

const display = (value?: bigint) => value === undefined ? '—' : Number(formatUnits(value, 6)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function GlobalPrizeDashboard() {
  const [data, setData] = useState<{ jackpot: bigint; weekly: bigint; available: number; networks: NetworkPrizeState[] }>();
  const [loading, setLoading] = useState(true);
  const refresh = async () => { setLoading(true); setData(await readGlobalPrizes()); setLoading(false); };
  useEffect(() => { void refresh(); }, []);

  return (
    <section className="global-prizes panel" aria-labelledby="global-prize-title">
      <div className="global-prize-heading">
        <div><p className="eyebrow">LIVE MULTI-CHAIN PRIZES</p><h2 id="global-prize-title">One lottery. Six verified networks.</h2></div>
        <button className="secondary refresh" onClick={refresh} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh live values'}</button>
      </div>
      <div className="global-prize-grid">
        <div className="global-total jackpot-total"><span>Global jackpot</span><small>All networks combined</small><strong>{data ? `$${display(data.jackpot)}` : 'Loading…'} <em>USDT</em></strong><i className="live-reading">{data ? 'Live read-only data' : 'Reading networks…'}</i></div>
        <div className="weekly-total"><TrophyMark /><span>This week’s prizes</span><small>All networks</small><strong>{data ? `$${display(data.weekly)}` : 'Loading…'} <em>USDT</em></strong></div>
        <div className="network-summary"><span>6 blockchain networks</span><div className="network-badges">{data?.networks.map((item) => <b key={item.chain.key} className={item.error ? 'unavailable' : ''}>{item.chain.name}</b>) ?? ['Polygon', 'BNB Chain', 'Arbitrum', 'Base', 'Optimism', 'Avalanche'].map((name) => <b key={name}>{name}</b>)}</div></div>
      </div>
      <p className={data?.available === 6 ? 'availability ok' : 'availability'}>{data ? `${data.available} of 6 networks available${data.available === 6 ? '' : ' · Aggregate is partial'}` : 'Reading each network independently…'}</p>
      {data && <details><summary>View per-network live breakdown</summary><div className="prize-table"><b>Network</b><b>Jackpot</b><b>Weekly pool</b><b>Status</b>{data.networks.map((item) => <div className="prize-row" key={item.chain.key}><span>{item.chain.name}</span><span>{display(item.jackpot)}</span><span>{display(item.weekly)}</span><span className={item.error ? 'down' : 'up'}>{item.error ? 'Unavailable' : 'Live'}</span></div>)}</div></details>}
    </section>
  );
}

