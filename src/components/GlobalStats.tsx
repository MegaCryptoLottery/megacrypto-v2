const pending = 'Unavailable — on-chain source pending';

export function GlobalStats() {
  return (
    <section className="global-stats" aria-label="Global lottery status">
      <div><span>Players</span><strong>{pending}</strong></div>
      <div><span>Tickets</span><strong>{pending}</strong></div>
      <div><span>Winners</span><strong>{pending}</strong></div>
      <div><span>Total prizes</span><strong>Shown in the live global dashboard</strong></div>
      <div className="vrf-stat"><span>Chainlink VRF</span><strong>Provably fair</strong></div>
    </section>
  );
}

