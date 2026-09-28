import type { ChainConfig } from '../types';
import { formatTokenAmount } from '../web3/transactions';
import { CURRENT_BET_SCAN_LIMIT, WINNER_HISTORY_LIMIT, type ClaimableTicket, type SelectedNetworkState } from '../web3/player';
import { useI18n } from '../i18n';

const short = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`;
const stateLabel = (state: number) => ['Open', 'Closed', 'Waiting for randomness', 'Randomness received', 'Calculating winners', 'Completed', 'Emergency'][state] ?? 'Unknown';
const prize = (amount: bigint, decimals: number) => formatTokenAmount(amount, decimals).replace(/^(\d+\.\d{2})\d*$/, '$1');

export function PlayerDashboard({ chain, state, wallet, onReviewClaim }: { chain: ChainConfig; state?: SelectedNetworkState; wallet?: string; onReviewClaim: (ticket: ClaimableTicket) => void }) {
  const { t } = useI18n();
  const claimable = state?.claimable;
  return <section id="tickets" className="player-dashboard panel" aria-label={t('myTickets')}>
    <div><p className="eyebrow">{t('myTickets')} · {chain.name.toUpperCase()}</p><h2>{t('onChainTickets')}</h2><small>{state ? `${state.scannedBets} ${t('tickets')}` : t('connectTickets')}</small></div>
    <div className="claimable"><span>{t('claimable')}</span><strong>{claimable === undefined ? '—' : claimable === 0n ? t('noClaimable') : `${prize(claimable, chain.contracts.tokenDecimals)} USDT`}</strong>{state?.claimableTickets.map((ticket) => <button type="button" key={`${ticket.roundId}-${ticket.offset}`} onClick={() => onReviewClaim(ticket)}>{t('claim')} {prize(ticket.amount, chain.contracts.tokenDecimals)} USDT</button>)}</div>
    {wallet && state?.tickets.length ? <div className="ticket-history">{state.tickets.map((ticket) => <article key={`${ticket.roundId}-${ticket.offset}`}><span>{t('round')} {ticket.roundId.toString()} · {stateLabel(ticket.state)} · {t('ticket')} {ticket.offset}</span><b>{t('ticket')}: {ticket.numbers.map((n) => String(n).padStart(2, '0')).join(' · ')}</b>{ticket.state === 5 && <><b>{t('draw')}: {ticket.winningNumbers.map((n) => String(n).padStart(2, '0')).join(' · ')}</b><span>{ticket.score} {t('hits')} · {ticket.finalist ? t('weeklyWinner') : t('notFinalist')}</span>{ticket.finalist && <span>{t('prize')}: {prize(ticket.amount, chain.contracts.tokenDecimals)} USDT · {ticket.claimed ? t('claimed') : t('availableUnclaimed')}</span>}</>}<a href={`${chain.explorer}/address/${ticket.wallet}`} target="_blank" rel="noreferrer">{short(ticket.wallet)} ↗</a></article>)}</div> : wallet && state ? <p className="empty">{t('noTickets')}</p> : null}
    <p className="data-limitation">For a connected wallet, up to the latest {WINNER_HISTORY_LIMIT} V2 rounds and {CURRENT_BET_SCAN_LIMIT} tickets per round are read directly from contract storage. No genesis scan is used.</p>
  </section>;
}
