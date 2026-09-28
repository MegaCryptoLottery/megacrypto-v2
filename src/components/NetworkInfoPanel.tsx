import type { ChainConfig } from '../types';
import { useI18n } from '../i18n';

export function NetworkInfoPanel({ chain, ticketPrice }: { chain: ChainConfig; ticketPrice: string }) {
  const { t } = useI18n();
  return (
    <aside className="panel play-info" aria-label="Selected network information">
      <div className="ticket-price-head"><span aria-hidden="true">◆</span><div><p className="eyebrow">{t('ticketPrice')}</p><h2>{ticketPrice} USDT</h2></div></div>
      <dl className="detail-list">
        <dt>{t('selectNetwork')}</dt><dd className="network-readout"><span aria-hidden="true">●</span>{chain.name}</dd>
        <dt>{t('lotteryContract')}</dt><dd className="mono contract-readout">{chain.contracts.lottery ?? t('verificationRequired')}<span aria-hidden="true">⧉</span></dd>
        <dt>{t('usdtContract')}</dt><dd className="mono contract-readout">{chain.contracts.token ?? t('verificationRequired')}<span aria-hidden="true">⧉</span></dd>
      </dl>
      <div className="verified-card"><span aria-hidden="true">✓</span><div><b>{chain.contracts.status === 'verified' ? t('networkVerified') : t('verificationRequired')}</b><small>{t('contractsVerified')}</small></div></div>
      <a className="explorer-link" href={chain.explorer} target="_blank" rel="noreferrer">{t('openExplorer')} ↗</a>
    </aside>
  );
}

