export function DrawPrizePanel({ jackpot, ticketPrice, network, numbers }: { jackpot: string; ticketPrice: string; network: string; numbers: number[] }) {
  return (
    <aside className="panel draw-prizes" aria-label="Draw and prize information">
      <p className="eyebrow">LIVE PRIZE INFORMATION</p>
      <h2>Your selection</h2>
      <div className="selection-preview"><span>{numbers.length}</span><small>of 15 selected</small></div>
      <div className="selected-number-chips" aria-label="Currently selected numbers">{numbers.length ? numbers.slice().sort((left, right) => left - right).map((number) => <b key={number}>{String(number).padStart(2, '0')}</b>) : <small>Choose your 15 numbers</small>}</div>
      <dl className="detail-list">
        <dt>Selected-network jackpot</dt><dd className="gold-value">{jackpot} USDT</dd>
        <dt>Global jackpot</dt><dd>Live total above</dd>
        <dt>This week’s prizes</dt><dd>Live total above</dd>
        <dt>Current ticket price</dt><dd>{ticketPrice} USDT</dd>
        <dt>Next draw</dt><dd>Unavailable — contract timing not exposed</dd>
      </dl>
      <p className="panel-note">Every value shown here comes from a read-only contract call or is explicitly unavailable.</p>
      <span className="network-chip">{network}</span>
    </aside>
  );
}

