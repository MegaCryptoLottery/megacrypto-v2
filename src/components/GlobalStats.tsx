import type { SelectedNetworkState } from '../web3/player';

export function GlobalStats({ selectedState }: { selectedState?: SelectedNetworkState }) {
  const bounded = selectedState && selectedState.scannedBets < selectedState.currentBets;
  return (
    <section className="global-stats" aria-label="Global lottery status">
      <div><span>Current round players</span><strong>{selectedState ? `${selectedState.currentPlayers}${bounded ? '+' : ''}` : '— Data pending'}</strong></div>
      <div><span>Current round tickets</span><strong>{selectedState ? selectedState.currentBets : '— Data pending'}</strong></div>
      <div><span>Winner records</span><strong>See recorded history</strong></div>
      <div><span>Prize pools</span><strong>Live above</strong></div>
      <div className="vrf-stat"><span>Chainlink VRF</span><strong>Verification pending</strong></div>
    </section>
  );
}
