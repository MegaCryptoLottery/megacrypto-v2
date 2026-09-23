import type { ChainConfig } from '../types';
import { formatUsdt } from '../web3/amounts';
import type { SelectedNetworkState } from '../web3/player';

const short = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`;

export function PlayerDashboard({ chain, state, wallet }: { chain: ChainConfig; state?: SelectedNetworkState; wallet?: string }) {
  const claimable = state?.claimable;
  return <section id="tickets" className="player-dashboard panel" aria-label="My tickets and rewards">
    <div><p className="eyebrow">MY TICKETS · {chain.name.toUpperCase()}</p><h2>Current on-chain tickets</h2><small>{state ? `${state.scannedBets} of ${state.currentBets} current tickets read from the V2 contract` : 'Connect a wallet to read current round tickets.'}</small></div>
    <div className="claimable"><span>CLAIMABLE PRIZE</span><strong>{claimable === undefined ? '—' : claimable === 0n ? 'No claimable prize' : `${formatUsdt(claimable, chain.contracts.tokenDecimals, 4)} USDT`}</strong>{claimable !== undefined && claimable > 0n && <small>Claim review is not enabled in this phase.</small>}</div>
    {wallet && state?.tickets.length ? <div className="ticket-history">{state.tickets.map((ticket) => <article key={ticket.index}><span>Current bet #{ticket.index + 1}</span><b>{ticket.numbers.length ? ticket.numbers.map((n) => String(n).padStart(2, '0')).join(' · ') : 'Mask cannot be decoded'}</b><a href={`${chain.explorer}/address/${ticket.wallet}`} target="_blank" rel="noreferrer">{short(ticket.wallet)} ↗</a></article>)}</div> : wallet && state ? <p className="empty">No matching ticket was found in the bounded current-week contract scan.</p> : null}
    <p className="data-limitation">This is a bounded scan of the current round’s ticket mapping. Historical tickets are not inferred until an audited event start block is configured.</p>
  </section>;
}
