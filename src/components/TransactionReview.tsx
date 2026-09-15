import { useState } from 'react';
import type { TransactionReview as Review } from '../web3/transactions';
import { formatTokenAmount } from '../web3/transactions';

const shortenAddress = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`;

function AddressRow({ label, explorer, address }: { label: string; explorer: string; address: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(address); setCopied(true); window.setTimeout(() => setCopied(false), 1400); } catch { /* Clipboard access is optional. */ }
  };
  return <div className="review-address"><span>{label}</span><code title={address}>{shortenAddress(address)}</code><button type="button" className="address-control" onClick={copy} aria-label={`Copy ${label} address`}>{copied ? 'Copied' : 'Copy'}</button><a className="address-control" href={`${explorer}/address/${address}`} target="_blank" rel="noreferrer" aria-label={`Open ${label} in explorer`}>↗</a></div>;
}

export function TransactionReview({ review, onConfirm, onCancel, busy }: { review: Review; onConfirm: () => void; onCancel: () => void; busy: boolean }) {
  const approval = review.kind === 'approval';
  const amount = `${formatTokenAmount(review.amount, review.decimals)} ${review.token}`;
  const buttonLabel = approval ? `Approve ${amount}` : `Buy Ticket · ${amount}`;
  return <div className="modal-backdrop" role="presentation"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="review-title">
    <header className="review-header"><div><p className="eyebrow">TRANSACTION REVIEW</p><small>No transaction sent yet</small><h2 id="review-title">{approval ? 'Approve USDT' : 'Buy Lottery Ticket'}</h2></div><span className="review-network-badge">{review.network}<small>Chain {review.chainId}</small></span></header>
    <div className="review-scroll">
      <section className="review-summary"><p>{approval ? 'YOU ARE AUTHORIZING' : 'TICKET PRICE'}</p><strong>{amount}</strong>{approval && <span>Spender: MegaCrypto Lottery</span>}</section>
      <section className="review-ticket-context"><p className="eyebrow">{approval ? 'TICKET SELECTED' : 'YOUR 15 NUMBERS'}</p><div className="review-number-chips">{review.numbers.map((number) => <b key={number}>{String(number).padStart(2, '0')}</b>)}</div>{approval && <small>These numbers are not part of the USDT approval transaction. They will be used only after you separately review and confirm the ticket purchase.</small>}</section>
      <section className="review-addresses"><AddressRow label="Wallet" explorer={review.explorer} address={review.wallet} /><AddressRow label="USDT Contract" explorer={review.explorer} address={review.tokenAddress} /><AddressRow label="Lottery Contract" explorer={review.explorer} address={review.lottery} /></section>
      <details className="review-details"><summary>Transaction Details <span>View all</span></summary><dl>
        <dt>Action</dt><dd>{approval ? 'Approve USDT' : 'Buy lottery ticket'}</dd><dt>Network</dt><dd>{review.network}</dd><dt>Chain ID</dt><dd>{review.chainId}</dd><dt>Function</dt><dd className="mono">{approval ? 'USDT.approve(lotteryAddress, exactTicketPrice)' : 'Lottery.comprarBilhete(uint8[])'}</dd><dt>Wallet</dt><dd className="mono">{review.wallet}</dd><dt>Token</dt><dd>{review.token}</dd><dt>Token contract</dt><dd className="mono">{review.tokenAddress}</dd><dt>{approval ? 'Spender / lottery contract' : 'Lottery contract'}</dt><dd className="mono">{review.lottery}</dd><dt>Wallet USDT balance</dt><dd>{formatTokenAmount(review.balance, review.decimals)} {review.token}</dd><dt>Current allowance</dt><dd>{formatTokenAmount(review.allowance, review.decimals)} {review.token}</dd><dt>Estimated gas</dt><dd>{review.gas.toString()} gas units</dd><dt>+20% safe gas limit</dt><dd>{review.gasLimit.toString()} gas units</dd>
      </dl></details>
      <p className="notice">{approval ? 'Only the exact live ticket price is being authorized. This does not purchase a ticket. After approval confirms, you must independently review and confirm the ticket purchase.' : 'Your wallet will receive the exact MegaCrypto Lottery transaction shown here. Verify the network, price and selected numbers before confirming.'}</p>
    </div>
    <div className="actions review-actions"><button className="secondary" onClick={onCancel} disabled={busy}>Cancel</button><button onClick={onConfirm} disabled={busy}>{busy ? 'Waiting for wallet…' : buttonLabel}</button></div>
  </section></div>;
}
