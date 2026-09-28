import { useEffect, useState } from 'react';
import { cutoffCountdown, roundLifecycle } from '../web3/round';
import { useI18n } from '../i18n';

export function DrawPrizePanel({ jackpot, weeklyPool, ticketPrice, network, chainId, numbers, closesAt, roundState, upkeepAction, onCutoffElapsed }: { jackpot: string; weeklyPool: string; ticketPrice: string; network: string; chainId: number; numbers: number[]; closesAt?: Date; roundState?: number; upkeepAction?: string; onCutoffElapsed?: () => void }) {
  const { t, date } = useI18n();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!closesAt || closesAt.getTime() <= Date.now()) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [closesAt?.getTime()]);
  useEffect(() => { if (closesAt && closesAt.getTime() <= now) onCutoffElapsed?.(); }, [closesAt, now, onCutoffElapsed]);
  const cutoff = closesAt && Number.isFinite(closesAt.getTime()) ? date(closesAt, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }) : undefined;
  const availability = roundLifecycle(roundState, closesAt, upkeepAction, now);
  const lifecycle = ({ 'AVAILABLE TO PLAY':'available', 'DRAW PROCESSING':'processing', 'WAITING FOR RANDOMNESS':'waiting', 'CALCULATING WINNERS':'calculating', 'NEXT ROUND OPENING':'opening' } as Record<string, string>)[availability.label] ?? availability.label;
  const lifecycleDetail = roundState === 0 && closesAt && closesAt.getTime() > now ? t('salesOpen')
    : roundState === 0 ? (upkeepAction ? t('waitingAction').replace('{{action}}', upkeepAction) : t('salesClosed'))
      : roundState === 1 ? (upkeepAction === 'REQUEST' ? t('waitingRequest') : t('roundClosed'))
        : roundState === 2 ? t('randomnessPending')
          : roundState === 3 || roundState === 4 ? (upkeepAction ? t('waitingAction').replace('{{action}}', upkeepAction) : t('settlementProgress'))
            : roundState === 5 ? (upkeepAction ? t('waitingAction').replace('{{action}}', upkeepAction) : t('roundComplete'))
              : t('roundUnavailable');
  return (
    <aside className="panel draw-prizes" aria-label={t('drawPrizeInfo')}>
      <section className="next-draw"><p className="eyebrow">◷ {t('currentRound')} <b>{t(lifecycle)}</b></p><h2>{roundState === 0 && closesAt && closesAt.getTime() > now ? t('nextDraw') : '—'} <small>{cutoff ?? t('scheduleUnavailable')}</small>{closesAt && roundState === 0 && <strong className="round-countdown" aria-label={t('timeRemaining')}>{cutoffCountdown(closesAt, now)}</strong>}<small className="round-availability">{lifecycleDetail}</small></h2></section>
      <section className="your-selection"><p className="eyebrow">⌁ {t('yourSelection')}</p><div className="selection-preview"><span>{numbers.length}</span><small>{t('of15Selected')}</small></div><div className="selected-number-chips" aria-label={t('selectedNumbers')}>{numbers.length ? numbers.slice().sort((left, right) => left - right).map((number) => <b key={number}>{String(number).padStart(2, '0')}</b>) : Array.from({ length: 15 }, (_, index) => <b className="empty-chip" key={index} />)}</div></section>
      <section className="prize-information"><p className="eyebrow">{t('playingOn')}</p><strong className="selected-network-name">{network}</strong><span className="network-chip">Chain ID {chainId}</span><dl className="detail-list"><dt>{network} {t('jackpot')}</dt><dd className="gold-value">{jackpot} USDT</dd><dt>{network} {t('weeklyPool')}</dt><dd className="gold-value">{weeklyPool} USDT</dd><dt>{t('ticketPrice')}</dt><dd>{ticketPrice} USDT</dd></dl><p className="network-prize-note">{t('networkPrizeNote')}</p></section>
    </aside>
  );
}
