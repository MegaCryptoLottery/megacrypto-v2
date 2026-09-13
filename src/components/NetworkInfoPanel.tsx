import type { ChainConfig } from '../types';

export function NetworkInfoPanel({ chain, ticketPrice }: { chain: ChainConfig; ticketPrice: string }) {
  return (
    <aside className="panel play-info" aria-label="Selected network information">
      <div className="ticket-price-head"><span aria-hidden="true">◆</span><div><p className="eyebrow">TICKET PRICE</p><h2>{ticketPrice} USDT</h2></div></div>
      <dl className="detail-list">
        <dt>Select network</dt><dd className="network-readout"><span aria-hidden="true">●</span>{chain.name}</dd>
        <dt>Lottery contract</dt><dd className="mono contract-readout">{chain.contracts.lottery ?? 'Verification Required'}<span aria-hidden="true">⧉</span></dd>
        <dt>USDT contract</dt><dd className="mono contract-readout">{chain.contracts.token ?? 'Verification Required'}<span aria-hidden="true">⧉</span></dd>
      </dl>
      <div className="verified-card"><span aria-hidden="true">✓</span><div><b>{chain.contracts.status === 'verified' ? 'Network Verified' : 'Verification Required'}</b><small>Contract and USDT verified</small></div></div>
      <a className="explorer-link" href={chain.explorer} target="_blank" rel="noreferrer">Open explorer ↗</a>
    </aside>
  );
}

