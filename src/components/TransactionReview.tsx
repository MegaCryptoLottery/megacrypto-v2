import { useState } from 'react';
import type { TransactionReview as Review } from '../web3/transactions';
import { formatTokenAmount } from '../web3/transactions';
import { useI18n } from '../i18n';

const shortenAddress = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`;

function AddressRow({ label, explorer, address }: { label: string; explorer: string; address: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(address); setCopied(true); window.setTimeout(() => setCopied(false), 1400); } catch { /* Clipboard access is optional. */ }
  };
  return <div className="review-address"><span>{label}</span><code title={address}>{shortenAddress(address)}</code><button type="button" className="address-control" onClick={copy} aria-label={`${t('copy')} ${label}`}>{copied ? t('copied') : t('copy')}</button><a className="address-control" href={`${explorer}/address/${address}`} target="_blank" rel="noreferrer" aria-label={`${t('openExplorer')} ${label}`}>↗</a></div>;
}

export function TransactionReview({ review, onConfirm, onCancel, busy }: { review: Review; onConfirm: () => void; onCancel: () => void; busy: boolean }) {
  const { t } = useI18n();
  const approval = review.kind === 'approval';
  const claim = review.kind === 'claim';
  const amount = `${formatTokenAmount(review.amount, review.decimals)} ${review.token}`;
  const buttonLabel = approval ? `${t('approve')} ${amount}` : claim ? `${t('claim')} ${amount}` : `${t('buyTicket')} · ${amount}`;
  return <div className="modal-backdrop" role="presentation"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="review-title">
    <header className="review-header"><div><p className="eyebrow">{t('reviewTransaction')}</p><small>{t('noTransaction')}</small><h2 id="review-title">{approval ? `${t('approve')} USDT` : claim ? t('claimPrize') : t('buyTicket')}</h2></div><span className="review-network-badge">{review.network}<small>Chain {review.chainId}</small></span></header>
    <div className="review-scroll">
      <section className="review-summary"><p>{approval ? t('authorizing') : claim ? t('claimable') : t('ticketPrice')}</p><strong>{amount}</strong>{approval && <span>{t('spender')}: MegaCrypto Lottery</span>}</section>
      {!claim && <section className="review-ticket-context"><p className="eyebrow">{approval ? t('ticketSelected') : t('yourNumbers')}</p><div className="review-number-chips">{review.numbers.map((number) => <b key={number}>{String(number).padStart(2, '0')}</b>)}</div>{approval && <small>{t('approvalNotice')}</small>}</section>}
      <section className="review-addresses"><AddressRow label={t('wallet')} explorer={review.explorer} address={review.wallet} /><AddressRow label={t('usdtContract')} explorer={review.explorer} address={review.tokenAddress} /><AddressRow label={t('lotteryContract')} explorer={review.explorer} address={review.lottery} /></section>
      <details className="review-details"><summary>{t('transactionDetails')} <span>{t('viewAll')}</span></summary><dl>
        <dt>{t('action')}</dt><dd>{approval ? `${t('approve')} USDT` : claim ? t('claimPrize') : t('buyTicket')}</dd><dt>{t('network')}</dt><dd>{review.network}</dd><dt>Chain ID</dt><dd>{review.chainId}</dd><dt>{t('function')}</dt><dd className="mono">{approval ? 'USDT.approve(lotteryAddress, exactTicketPrice)' : claim ? 'Lottery.claim(uint256,uint256)' : 'Lottery.buyTicket(uint32)'}</dd>{claim && <><dt>{t('round')} / {t('ticket')}</dt><dd>{review.roundId?.toString()} / {review.ticketOffset}</dd></>}<dt>{t('wallet')}</dt><dd className="mono">{review.wallet}</dd><dt>{t('token')}</dt><dd>{review.token}</dd><dt>{t('tokenContract')}</dt><dd className="mono">{review.tokenAddress}</dd><dt>{approval ? t('spenderLottery') : t('lotteryContract')}</dt><dd className="mono">{review.lottery}</dd><dt>{t('walletBalance')}</dt><dd>{formatTokenAmount(review.balance, review.decimals)} {review.token}</dd>{!claim && <><dt>{t('currentAllowance')}</dt><dd>{formatTokenAmount(review.allowance, review.decimals)} {review.token}</dd></>}<dt>{t('estimatedGas')}</dt><dd>{review.gas.toString()} {t('gasUnits')}</dd><dt>{t('safeGasLimit')}</dt><dd>{review.gasLimit.toString()} {t('gasUnits')}</dd>
      </dl></details>
      <p className="notice">{approval ? 'Only the exact live ticket price is being authorized. This does not purchase a ticket. After approval confirms, you must independently review and confirm the ticket purchase.' : claim ? 'Your wallet will receive the exact claim transaction shown here. Verify the network, prize amount and ticket reference before confirming.' : 'Your wallet will receive the exact MegaCrypto Lottery transaction shown here. Verify the network, price and selected numbers before confirming.'}</p>
    </div>
    <div className="actions review-actions"><button className="secondary" onClick={onCancel} disabled={busy}>{t('cancel')}</button><button onClick={onConfirm} disabled={busy}>{busy ? t('waitingWallet') : buttonLabel}</button></div>
  </section></div>;
}
