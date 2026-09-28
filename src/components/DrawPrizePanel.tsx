const roundCutoff = (date?: Date) => date && Number.isFinite(date.getTime())
  ? new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(date)
  : undefined;

const roundStatus = (state: number | undefined, cutoff: Date | undefined, upkeepAction: string | undefined) => {
  if (state === undefined) return { label: 'LOADING', detail: 'Checking live contract state' };
  if (state === 0 && cutoff && cutoff.getTime() > Date.now()) return { label: 'AVAILABLE TO PLAY', detail: 'Ticket sales are open' };
  if (state === 0) return { label: 'DRAW PROCESSING', detail: upkeepAction ? `Waiting for ${upkeepAction}` : 'Ticket sales are closed' };
  if (state === 1) return { label: 'DRAW PROCESSING', detail: upkeepAction === 'REQUEST' ? 'Waiting for randomness request' : 'Round is closed' };
  if (state === 2) return { label: 'WAITING FOR RANDOMNESS', detail: 'Randomness request is pending' };
  if (state === 3 || state === 4) return { label: 'CALCULATING WINNERS', detail: upkeepAction ? `Waiting for ${upkeepAction}` : 'Settlement is in progress' };
  if (state === 5) return { label: 'NEXT ROUND OPENING', detail: upkeepAction ? `Waiting for ${upkeepAction}` : 'Round is complete' };
  return { label: 'UNAVAILABLE', detail: 'This round is not accepting tickets' };
};

export function DrawPrizePanel({ jackpot, weeklyPool, ticketPrice, network, chainId, numbers, closesAt, roundState, upkeepAction }: { jackpot: string; weeklyPool: string; ticketPrice: string; network: string; chainId: number; numbers: number[]; closesAt?: Date; roundState?: number; upkeepAction?: string }) {
  const cutoff = roundCutoff(closesAt);
  const availability = roundStatus(roundState, closesAt, upkeepAction);
  return (
    <aside className="panel draw-prizes" aria-label="Draw and prize information">
      <section className="next-draw"><p className="eyebrow">◷ CURRENT ROUND <b>{availability.label}</b></p><h2>{cutoff ? 'Closes' : '—'} <small>{cutoff ?? 'Schedule not exposed on-chain'}</small><small className="round-availability">{availability.detail}</small></h2></section>
      <section className="your-selection"><p className="eyebrow">⌁ YOUR SELECTION</p><div className="selection-preview"><span>{numbers.length}</span><small>of 15 selected</small></div><div className="selected-number-chips" aria-label="Currently selected numbers">{numbers.length ? numbers.slice().sort((left, right) => left - right).map((number) => <b key={number}>{String(number).padStart(2, '0')}</b>) : Array.from({ length: 15 }, (_, index) => <b className="empty-chip" key={index} />)}</div></section>
      <section className="prize-information"><p className="eyebrow">YOU ARE PLAYING ON</p><strong className="selected-network-name">{network}</strong><span className="network-chip">Chain ID {chainId}</span><dl className="detail-list"><dt>{network} jackpot</dt><dd className="gold-value">{jackpot} USDT</dd><dt>{network} weekly prize pool</dt><dd className="gold-value">{weeklyPool} USDT</dd><dt>Ticket price</dt><dd>{ticketPrice} USDT</dd></dl><p className="network-prize-note">Your ticket competes only in the selected network’s lottery pools.</p></section>
    </aside>
  );
}
