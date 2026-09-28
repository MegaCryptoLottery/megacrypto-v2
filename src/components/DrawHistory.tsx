import { useEffect, useState } from 'react';
import { CHAINS } from '../config/chains';
import type { ChainKey } from '../types';
import { readRecentDrawPage, type DrawEvent, type DrawPage } from '../web3/events';
import { useI18n } from '../i18n';

type State = Partial<Record<ChainKey, DrawPage>>;
export function DrawHistory({ refreshKey }: { refreshKey: number }) {
  const { t, date } = useI18n();
  const [pages, setPages] = useState<State>({});
  useEffect(() => { let cancelled = false; Promise.all(Object.values(CHAINS).map(async (chain) => [chain.key, await readRecentDrawPage(chain)] as const)).then((rows) => { if (!cancelled) setPages(Object.fromEntries(rows)); }); return () => { cancelled = true; }; }, [refreshKey]);
  const draws = Object.values(pages).flatMap((page) => page?.draws ?? []).sort((a, b) => b.timestamp - a.timestamp);
  return <section id="draws" className="draw-history panel"><p className="eyebrow">{t('drawHistory')}</p><h2>{t('verifiedDraws')}</h2><p className="data-limitation">{t('drawHistoryLimit')}</p>{draws.length ? <div className="winner-records">{draws.map((draw: DrawEvent) => <article key={`${draw.chain.key}-${draw.transactionHash}`}><b>{draw.chain.name}</b><strong>{t('round')} {draw.roundId.toString()} · Request ID: {draw.requestId.toString()}</strong><span>{t('winningNumbers')}: {draw.numbers.map((number) => String(number).padStart(2, '0')).join(' · ') || t('noResults')}</span><span>Mask: {draw.mask.toString()} · {t('block')} {draw.blockNumber}</span><a href={`${draw.chain.explorer}/tx/${draw.transactionHash}`} target="_blank" rel="noreferrer">{draw.timestamp ? date(new Date(draw.timestamp * 1000)) : t('timestampUnavailable')} · {t('viewTransaction')} ↗</a></article>)}</div> : <p className="empty">{t('noRecentDraws')}</p>}<div className="draw-health">{Object.values(CHAINS).map((chain) => <span key={chain.key}>{pages[chain.key]?.error ? `${chain.name}: ${t('rpcRetry')}` : `${chain.name}: ${pages[chain.key]?.draws.length ?? 0} ${t('recentDraws')}`}</span>)}</div></section>;
}
