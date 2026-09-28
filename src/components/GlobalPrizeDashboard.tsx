import { useEffect, useRef, useState } from 'react';
import { readGlobalPrizes, type NetworkPrizeState } from '../web3/dashboard';
import { formatNormalizedUsdt } from '../web3/amounts';
import { TrophyMark } from './TrophyMark';
import { NetworkIcon } from './NetworkIcon';
import { RequestGeneration } from '../web3/requestGeneration';
import { useI18n } from '../i18n';

const display = (value?: bigint) => formatNormalizedUsdt(value, 2, 2);

export function GlobalPrizeDashboard({ refreshKey = 0 }: { refreshKey?: number }) {
  const { t } = useI18n();
  const [data, setData] = useState<{ jackpot: bigint; weekly: bigint; available: number; networks: NetworkPrizeState[] }>();
  const [loading, setLoading] = useState(true);
  const generation = useRef(new RequestGeneration());
  const refresh = async () => {
    const current = generation.current.begin(); setLoading(true);
    const next = await readGlobalPrizes();
    if (!generation.current.isCurrent(current)) return;
    setData(next); setLoading(false);
  };
  useEffect(() => { void refresh(); }, [refreshKey]);

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
      <h2 id="global-prize-title" className="sr-only">{t('live')}</h2><div className="global-prize-controls"><button className="secondary refresh" onClick={refresh} disabled={loading}>{loading ? t('reviewing') : `↻ ${t('refresh')}`}</button></div>
      <div className="global-prize-grid">
        <div className="global-total jackpot-total"><span>{t('global')}</span><small>{t('allNetworksCombined')}</small><strong>{data ? display(data.jackpot) : t('loading')} <em>USDT</em></strong><div className="prize-divider" aria-hidden="true" /><p className="prize-copy">{t('combinedJackpot')}</p></div>
        <div className="trophy-column"><TrophyMark /></div>
        <div className="weekly-total"><span>{t('weekly')}</span><small>{t('allNetworks')}</small><strong>{data ? display(data.weekly) : t('loading')} <em>USDT</em></strong><div className="prize-divider" aria-hidden="true" /><p className="prize-copy">{t('combinedWeekly')}</p></div>
        <div className="network-summary"><span>{t('sixNetworks')}</span><div className="network-badges">{Object.values(data?.networks ?? []).map((item) => <b key={item.chain.key} className={item.error ? 'unavailable' : ''}><NetworkIcon chain={item.chain.key} label={item.chain.name} />{item.chain.name}</b>) ?? null}{!data && Object.values(['polygon', 'bsc', 'arbitrum', 'base', 'optimism', 'avalanche'] as const).map((key) => <b key={key}><NetworkIcon chain={key} />{{ polygon: 'Polygon', bsc: 'BNB Smart Chain', arbitrum: 'Arbitrum One', base: 'Base', optimism: 'Optimism', avalanche: 'Avalanche' }[key]}</b>)}</div></div>
      </div>
      <i className="live-reading">{data ? t('live') : t('readingNetworks')}</i>
      <p className={data?.available === 6 ? 'availability ok' : 'availability'}>{data ? `${data.available} ${t('ofSixNetworks')}${data.available === 6 ? '' : ` · ${t('aggregatePartial')}`}` : t('readingNetworksIndependently')}</p>
      {data && <details><summary>View per-network live breakdown</summary><div className="prize-table"><b>Network</b><b>Jackpot</b><b>Weekly pool</b><b>Status</b>{data.networks.map((item) => <div className="prize-row" key={item.chain.key}><span>{item.chain.name}</span><span>{display(item.jackpotUsdt)}</span><span>{display(item.weeklyUsdt)}</span><span className={item.error ? 'down' : 'up'}>{item.error ? 'Unavailable' : 'Live'}</span></div>)}</div></details>}
    </section>
  );
}
