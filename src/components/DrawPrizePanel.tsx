export function DrawPrizePanel({ jackpot, ticketPrice, network, numbers }: { jackpot: string; ticketPrice: string; network: string; numbers: number[] }) {
  return (
    <aside className="panel draw-prizes" aria-label="Draw and prize information">
      <section className="next-draw"><p className="eyebrow">◷ NEXT DRAW <b>DATA PENDING</b></p><h2>— <small>Timing unavailable</small></h2></section>
      <section className="your-selection"><p className="eyebrow">⌁ YOUR SELECTION</p><div className="selection-preview"><span>{numbers.length}</span><small>of 15 selected</small></div><div className="selected-number-chips" aria-label="Currently selected numbers">{numbers.length ? numbers.slice().sort((left, right) => left - right).map((number) => <b key={number}>{String(number).padStart(2, '0')}</b>) : Array.from({ length: 15 }, (_, index) => <b className="empty-chip" key={index} />)}</div></section>
      <section className="prize-information"><p className="eyebrow">♛ PRIZE INFORMATION</p><dl className="detail-list"><dt>Selected-network jackpot</dt><dd className="gold-value">{jackpot} USDT</dd><dt>Global jackpot</dt><dd>Live total above</dd><dt>This week’s prizes</dt><dd>Live total above</dd><dt>Current ticket price</dt><dd>{ticketPrice} USDT</dd></dl><span className="network-chip">{network}</span></section>
    </aside>
  );
}

