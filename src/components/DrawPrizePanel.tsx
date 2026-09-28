import { useEffect, useState } from 'react';
import { cutoffCountdown, roundLifecycle } from '../web3/round';

const roundCutoff = (date?: Date) => date && Number.isFinite(date.getTime())
  ? new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(date)
  : undefined;

export function DrawPrizePanel({ jackpot, weeklyPool, ticketPrice, network, chainId, numbers, closesAt, roundState, upkeepAction, onCutoffElapsed }: { jackpot: string; weeklyPool: string; ticketPrice: string; network: string; chainId: number; numbers: number[]; closesAt?: Date; roundState?: number; upkeepAction?: string; onCutoffElapsed?: () => void }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!closesAt || closesAt.getTime() <= Date.now()) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [closesAt?.getTime()]);
  useEffect(() => { if (closesAt && closesAt.getTime() <= now) onCutoffElapsed?.(); }, [closesAt, now, onCutoffElapsed]);
  const cutoff = roundCutoff(closesAt);
  const availability = roundLifecycle(roundState, closesAt, upkeepAction, now);
  return (
    <aside className="panel draw-prizes" aria-label="Draw and prize information">
      <section className="next-draw"><p className="eyebrow">◷ CURRENT ROUND <b>{availability.label}</b></p><h2>{cutoff ? 'Closes' : '—'} <small>{cutoff ?? 'Schedule not exposed on-chain'}</small>{closesAt && roundState === 0 && <strong className="round-countdown" aria-label="Time until the on-chain cutoff">{cutoffCountdown(closesAt, now)}</strong>}<small className="round-availability">{availability.detail}</small></h2></section>
      <section className="your-selection"><p className="eyebrow">⌁ YOUR SELECTION</p><div className="selection-preview"><span>{numbers.length}</span><small>of 15 selected</small></div><div className="selected-number-chips" aria-label="Currently selected numbers">{numbers.length ? numbers.slice().sort((left, right) => left - right).map((number) => <b key={number}>{String(number).padStart(2, '0')}</b>) : Array.from({ length: 15 }, (_, index) => <b className="empty-chip" key={index} />)}</div></section>
      <section className="prize-information"><p className="eyebrow">YOU ARE PLAYING ON</p><strong className="selected-network-name">{network}</strong><span className="network-chip">Chain ID {chainId}</span><dl className="detail-list"><dt>{network} jackpot</dt><dd className="gold-value">{jackpot} USDT</dd><dt>{network} weekly prize pool</dt><dd className="gold-value">{weeklyPool} USDT</dd><dt>Ticket price</dt><dd>{ticketPrice} USDT</dd></dl><p className="network-prize-note">Your ticket competes only in the selected network’s lottery pools.</p></section>
    </aside>
  );
}
