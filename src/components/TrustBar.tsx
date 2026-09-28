import { useI18n } from '../i18n';
const items = [['◈', 'secure'], ['✦', 'fairDraws'], ['⛓', 'multiChain'], ['◎', 'community']];
export function TrustBar() { const { t } = useI18n(); return <section className="trust-bar" aria-label={t('principles')}>{items.map(([icon, label]) => <div key={label}><span aria-hidden="true">{icon}</span>{t(label)}</div>)}</section>; }

