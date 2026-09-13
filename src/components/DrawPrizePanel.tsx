export function DrawPrizePanel({ jackpot, ticketPrice, network }: { jackpot: string; ticketPrice: string; network: string }) {
  return (
    <aside className="panel draw-prizes" aria-label="Draw and prize information">
      <p className="eyebrow">LIVE PRIZE INFORMATION</p>
      <h2>Your selection</h2>
      <div className="selection-preview"><span>15</span><small>numbers required</small></div>
      <dl className="detail-list">
        <dt>Selected-network jackpot</dt><dd className="gold-value">{jackpot} USDT</dd>
        <dt>This week’s prizes</dt><dd>Live global total above</dd>
        <dt>Current ticket price</dt><dd>{ticketPrice} USDT</dd>
        <dt>Next draw</dt><dd>Unavailable — contract timing not exposed</dd>
      </dl>
      <p className="panel-note">Every value shown here comes from a read-only contract call or is explicitly unavailable.</p>
      <span className="network-chip">{network}</span>
    </aside>
  );
}

