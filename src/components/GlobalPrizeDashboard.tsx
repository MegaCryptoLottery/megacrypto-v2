import { useEffect, useState } from 'react';
import { readGlobalPrizes, type NetworkPrizeState } from '../web3/dashboard';
import { formatNormalizedUsdt } from '../web3/amounts';
import { TrophyMark } from './TrophyMark';
import { NetworkIcon } from './NetworkIcon';

const display = (value?: bigint) => formatNormalizedUsdt(value, 2, 2);

export function GlobalPrizeDashboard() {
  const [data, setData] = useState<{ jackpot: bigint; weekly: bigint; available: number; networks: NetworkPrizeState[] }>();
  const [loading, setLoading] = useState(true);
  const refresh = async () => { setLoading(true); setData(await readGlobalPrizes()); setLoading(false); };
  useEffect(() => { void refresh(); }, []);

  return (
    <section className="global-prizes panel" aria-labelledby="global-prize-title">
      <img
        src={`${import.meta.env.BASE_URL}assets/hero/planet-hero.webp`}
        alt=""
        aria-hidden="true"
        decoding="async"
        className="hero-earth"
      />
      <div aria-hidden="true" className="hero-earth-overlay" />
      <h2 id="global-prize-title" className="sr-only">Live multi-chain prizes</h2><div className="global-prize-controls"><button className="secondary refresh" onClick={refresh} disabled={loading}>{loading ? 'Refreshing…' : '↻ Refresh'}</button></div>
      <div className="global-prize-grid">
        <div className="global-total jackpot-total"><span>Global jackpot</span><small>All networks combined</small><strong>{data ? display(data.jackpot) : 'Loading…'} <em>USDT</em></strong><div className="prize-divider" aria-hidden="true" /><p className="prize-copy">Total prize pool across all 6 networks</p></div>
        <div className="trophy-column"><TrophyMark /></div>
        <div className="weekly-total"><span>This week’s prizes</span><small>All networks</small><strong>{data ? display(data.weekly) : 'Loading…'} <em>USDT</em></strong><div className="prize-divider" aria-hidden="true" /><p className="prize-copy">Current weekly prize pool across all networks</p></div>
        <div className="network-summary"><span>6 blockchain networks</span><div className="network-badges">{Object.values(data?.networks ?? []).map((item) => <b key={item.chain.key} className={item.error ? 'unavailable' : ''}><NetworkIcon chain={item.chain.key} label={item.chain.name} />{item.chain.name}</b>) ?? null}{!data && Object.values(['polygon', 'bsc', 'arbitrum', 'base', 'optimism', 'avalanche'] as const).map((key) => <b key={key}><NetworkIcon chain={key} />{{ polygon: 'Polygon', bsc: 'BNB Smart Chain', arbitrum: 'Arbitrum One', base: 'Base', optimism: 'Optimism', avalanche: 'Avalanche' }[key]}</b>)}</div></div>
      </div>
      <i className="live-reading">{data ? 'Live read-only data' : 'Reading networks…'}</i>
      <p className={data?.available === 6 ? 'availability ok' : 'availability'}>{data ? `${data.available} of 6 networks available${data.available === 6 ? '' : ' · Aggregate is partial'}` : 'Reading each network independently…'}</p>
      {data && <details><summary>View per-network live breakdown</summary><div className="prize-table"><b>Network</b><b>Jackpot</b><b>Weekly pool</b><b>Status</b>{data.networks.map((item) => <div className="prize-row" key={item.chain.key}><span>{item.chain.name}</span><span>{display(item.jackpotUsdt)}</span><span>{display(item.weeklyUsdt)}</span><span className={item.error ? 'down' : 'up'}>{item.error ? 'Unavailable' : 'Live'}</span></div>)}</div></details>}
    </section>
  );
}
