import type { TransactionReview as Review } from '../web3/transactions';
import { formatTokenAmount } from '../web3/transactions';

const addressLink = (explorer: string, address: string) => <a className="mono" href={`${explorer}/address/${address}`} target="_blank" rel="noreferrer">{address} ↗</a>;

export function TransactionReview({ review, onConfirm, onCancel, busy }: { review: Review; onConfirm: () => void; onCancel: () => void; busy: boolean }) {
  const approval = review.kind === 'approval';
  const amount = `${formatTokenAmount(review.amount, review.decimals)} ${review.token}`;
  return <div className="modal-backdrop" role="presentation"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="review-title">
    <p className="eyebrow">TRANSACTION REVIEW · NO TRANSACTION SENT</p><h2 id="review-title">{approval ? 'Approve exact USDT amount' : 'Buy lottery ticket'}</h2>
    <dl className="review-details">
      <dt>Action</dt><dd>{approval ? 'Approve USDT' : 'Buy lottery ticket'}</dd><dt>Network</dt><dd>{review.network} (chain ID {review.chainId})</dd><dt>Wallet</dt><dd>{addressLink(review.explorer, review.wallet)}</dd>
      <dt>Function</dt><dd className="mono">{approval ? 'USDT.approve(lotteryAddress, exactTicketPrice)' : 'Lottery.comprarBilhete(uint8[])'}</dd><dt>Token</dt><dd>{review.token}</dd><dt>Token contract</dt><dd>{addressLink(review.explorer, review.tokenAddress)}</dd>
      <dt>{approval ? 'Spender / lottery contract' : 'Lottery contract'}</dt><dd>{addressLink(review.explorer, review.lottery)}</dd><dt>{approval ? 'Approval amount' : 'Live ticket price'}</dt><dd>{amount}</dd>
      <dt>Wallet USDT balance</dt><dd>{formatTokenAmount(review.balance, review.decimals)} {review.token}</dd><dt>Current allowance</dt><dd>{formatTokenAmount(review.allowance, review.decimals)} {review.token}</dd>
      {!approval && <><dt>Selected numbers</dt><dd>{review.numbers.map((number) => String(number).padStart(2, '0')).join(' · ')}</dd></>}
      <dt>Estimated gas</dt><dd>{review.gas.toString()} gas units</dd><dt>20% safe gas limit</dt><dd>{review.gasLimit.toString()} gas units</dd>
    </dl>
    <p className="notice">{approval ? 'This approval is limited to one live ticket price. After it confirms, you must independently review the ticket purchase; it will not be sent automatically.' : 'This review prepares only the deployed lottery call shown above. Confirming opens your connected wallet for this exact request.'}</p>
    <div className="actions"><button className="secondary" onClick={onCancel} disabled={busy}>Cancel</button><button onClick={onConfirm} disabled={busy}>{busy ? 'Submitting…' : approval ? 'Confirm USDT approval' : 'Confirm ticket purchase'}</button></div>
  </section></div>;
}
