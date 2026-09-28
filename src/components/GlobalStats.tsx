import type { SelectedNetworkState } from '../web3/player';
import { useI18n } from '../i18n';

export function GlobalStats({ selectedState }: { selectedState?: SelectedNetworkState }) {
  const { t } = useI18n();
  const bounded = selectedState && selectedState.scannedBets < selectedState.currentBets;
  return (
    <section className="global-stats" aria-label={t('globalStatus')}>
      <div><span>{t('currentPlayers')}</span><strong>{selectedState ? `${selectedState.currentPlayers}${bounded ? '+' : ''}` : `— ${t('dataPending')}`}</strong></div>
      <div><span>{t('currentTickets')}</span><strong>{selectedState ? selectedState.currentBets : `— ${t('dataPending')}`}</strong></div>
      <div><span>{t('winnerRecords')}</span><strong>{t('recordedHistory')}</strong></div>
      <div><span>{t('prizePools')}</span><strong>{t('liveAbove')}</strong></div>
      <div className="vrf-stat"><span>Chainlink VRF</span><strong>{t('verificationPending')}</strong></div>
    </section>
  );
}
