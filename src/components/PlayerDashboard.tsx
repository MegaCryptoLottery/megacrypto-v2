import type { ChainConfig } from '../types';
import { formatTokenAmount } from '../web3/transactions';
import { CURRENT_BET_SCAN_LIMIT, WINNER_HISTORY_LIMIT, type ClaimableTicket, type SelectedNetworkState } from '../web3/player';

const short = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`;
const stateLabel = (state: number) => ['Open', 'Closed', 'Waiting for randomness', 'Randomness received', 'Calculating winners', 'Completed', 'Emergency'][state] ?? 'Unknown';
const prize = (amount: bigint, decimals: number) => formatTokenAmount(amount, decimals).replace(/^(\d+\.\d{2})\d*$/, '$1');

export function PlayerDashboard({ chain, state, wallet, onReviewClaim }: { chain: ChainConfig; state?: SelectedNetworkState; wallet?: string; onReviewClaim: (ticket: ClaimableTicket) => void }) {
  const claimable = state?.claimable;
  return <section id="tickets" className="player-dashboard panel" aria-label="My tickets and rewards">
    <div><p className="eyebrow">MY TICKETS · {chain.name.toUpperCase()}</p><h2>On-chain tickets and prizes</h2><small>{state ? `${state.scannedBets} matching ticket${state.scannedBets === 1 ? '' : 's'} found in the bounded V2 round scan` : 'Connect a wallet to read tickets and claimable prizes.'}</small></div>
    <div className="claimable"><span>CLAIMABLE PRIZE</span><strong>{claimable === undefined ? '—' : claimable === 0n ? 'No claimable prize' : `${prize(claimable, chain.contracts.tokenDecimals)} USDT`}</strong>{state?.claimableTickets.map((ticket) => <button type="button" key={`${ticket.roundId}-${ticket.offset}`} onClick={() => onReviewClaim(ticket)}>CLAIM {prize(ticket.amount, chain.contracts.tokenDecimals)} USDT</button>)}</div>
    {wallet && state?.tickets.length ? <div className="ticket-history">{state.tickets.map((ticket) => <article key={`${ticket.roundId}-${ticket.offset}`}><span>Round {ticket.roundId.toString()} · {stateLabel(ticket.state)} · Ticket offset {ticket.offset}</span><b>Ticket: {ticket.numbers.map((n) => String(n).padStart(2, '0')).join(' · ')}</b>{ticket.state === 5 && <><b>Draw: {ticket.winningNumbers.map((n) => String(n).padStart(2, '0')).join(' · ')}</b><span>{ticket.score} hit{ticket.score === 1 ? '' : 's'} · {ticket.finalist ? 'Weekly winner / finalist' : 'Not a finalist'}</span>{ticket.finalist && <span>Prize: {prize(ticket.amount, chain.contracts.tokenDecimals)} USDT · {ticket.claimed ? 'Claimed' : 'Available / unclaimed'}</span>}</>}<a href={`${chain.explorer}/address/${ticket.wallet}`} target="_blank" rel="noreferrer">{short(ticket.wallet)} ↗</a></article>)}</div> : wallet && state ? <p className="empty">No matching ticket was found in the bounded historical V2 round scan.</p> : null}
    <p className="data-limitation">For a connected wallet, up to the latest {WINNER_HISTORY_LIMIT} V2 rounds and {CURRENT_BET_SCAN_LIMIT} tickets per round are read directly from contract storage. No genesis scan is used.</p>
  </section>;
}
