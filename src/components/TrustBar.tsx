const items = [['◈', 'Secure & Transparent'], ['✦', 'Fair Drawings'], ['⛓', 'Multi-Chain'], ['◎', 'Global Community']];
export function TrustBar() { return <section className="trust-bar" aria-label="Lottery principles">{items.map(([icon, label]) => <div key={label}><span aria-hidden="true">{icon}</span>{label}</div>)}</section>; }

