export function DrawPrizePanel({ jackpot, weeklyPool, ticketPrice, network, chainId, numbers }: { jackpot: string; weeklyPool: string; ticketPrice: string; network: string; chainId: number; numbers: number[] }) {
  return (
    <aside className="panel draw-prizes" aria-label="Draw and prize information">
      <section className="next-draw"><p className="eyebrow">◷ NEXT DRAW <b>NOT EXPOSED</b></p><h2>— <small>Schedule not exposed on-chain</small></h2></section>
      <section className="your-selection"><p className="eyebrow">⌁ YOUR SELECTION</p><div className="selection-preview"><span>{numbers.length}</span><small>of 15 selected</small></div><div className="selected-number-chips" aria-label="Currently selected numbers">{numbers.length ? numbers.slice().sort((left, right) => left - right).map((number) => <b key={number}>{String(number).padStart(2, '0')}</b>) : Array.from({ length: 15 }, (_, index) => <b className="empty-chip" key={index} />)}</div></section>
      <section className="prize-information"><p className="eyebrow">YOU ARE PLAYING ON</p><strong className="selected-network-name">{network}</strong><span className="network-chip">Chain ID {chainId}</span><dl className="detail-list"><dt>{network} jackpot</dt><dd className="gold-value">{jackpot} USDT</dd><dt>{network} weekly prize pool</dt><dd className="gold-value">{weeklyPool} USDT</dd><dt>Ticket price</dt><dd>{ticketPrice} USDT</dd></dl><p className="network-prize-note">Your ticket competes only in the selected network’s lottery pools.</p></section>
    </aside>
  );
}
