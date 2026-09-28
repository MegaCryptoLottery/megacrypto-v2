import { CHAINS } from '../config/chains';
import { NetworkIcon } from './NetworkIcon';
import { useI18n } from '../i18n';
export function NetworkGrid({ selected, onSelect }: { selected: string; onSelect: (key: keyof typeof CHAINS) => void }) { const { t } = useI18n(); return <section className="panel network-grid-panel"><div className="section-heading"><div><p className="eyebrow">{t('multiChain')}</p><h2>{t('chooseNetwork')}</h2></div><span className="muted">{t('deploymentsVerification')}</span></div><div className="networks">{Object.values(CHAINS).map(chain => <button key={chain.key} className={`network ${selected === chain.key ? 'selected' : ''}`} onClick={() => onSelect(chain.key)}><NetworkIcon chain={chain.key} label={chain.name}/><span>{chain.name}</span><small>{chain.contracts.status === 'verified' ? t('live') : t('verificationRequired')}</small></button>)}</div></section>; }

