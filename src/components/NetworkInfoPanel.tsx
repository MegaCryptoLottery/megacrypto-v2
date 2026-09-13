import type { ChainConfig } from '../types';

export function NetworkInfoPanel({ chain, ticketPrice }: { chain: ChainConfig; ticketPrice: string }) {
  return (
    <aside className="panel play-info" aria-label="Selected network information">
      <p className="eyebrow">PLAY DETAILS</p>
      <h2>Verified on-chain ticket</h2>
      <dl className="detail-list">
        <dt>Ticket price</dt><dd>{ticketPrice} USDT</dd>
        <dt>Selected network</dt><dd>{chain.name}</dd>
        <dt>Lottery contract</dt><dd className="mono">{chain.contracts.lottery ?? 'Verification Required'}</dd>
        <dt>USDT contract</dt><dd className="mono">{chain.contracts.token ?? 'Verification Required'}</dd>
        <dt>Network status</dt><dd className="verified">{chain.contracts.status === 'verified' ? 'Verified' : 'Verification Required'}</dd>
      </dl>
      <a className="explorer-link" href={chain.explorer} target="_blank" rel="noreferrer">Open explorer ↗</a>
    </aside>
  );
}

