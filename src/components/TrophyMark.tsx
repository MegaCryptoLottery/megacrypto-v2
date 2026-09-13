export function TrophyMark() {
  return (
    <svg className="trophy-mark" viewBox="0 0 180 180" role="img" aria-label="Lottery trophy">
      <defs>
        <linearGradient id="trophyGold" x1="0" x2="1" y1="0" y2="1"><stop stopColor="#fff2a9" /><stop offset=".32" stopColor="#e8b94b" /><stop offset=".7" stopColor="#99631a" /><stop offset="1" stopColor="#f6d26a" /></linearGradient>
        <linearGradient id="trophyPurple" x1="0" x2="1"><stop stopColor="#a88dff" /><stop offset="1" stopColor="#5a4ccd" /></linearGradient>
        <filter id="trophyGlow"><feGaussianBlur stdDeviation="5" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      </defs>
      <circle className="trophy-orbit" cx="90" cy="90" r="77" fill="none" stroke="url(#trophyPurple)" strokeWidth="1.5" />
      <circle className="trophy-orbit trophy-orbit-inner" cx="90" cy="90" r="61" fill="none" stroke="#f3ca6344" strokeWidth="1" />
      <path d="M57 49h66v27c0 31-15 48-33 48S57 107 57 76V49Z" fill="url(#trophyGold)" filter="url(#trophyGlow)" />
      <path d="M57 58H37v18c0 18 11 29 29 29" fill="none" stroke="url(#trophyGold)" strokeWidth="9" strokeLinecap="round" />
      <path d="M123 58h20v18c0 18-11 29-29 29" fill="none" stroke="url(#trophyGold)" strokeWidth="9" strokeLinecap="round" />
      <path d="M80 123h20v19H80zM62 145h56c5 0 9 4 9 9v3H53v-3c0-5 4-9 9-9Z" fill="url(#trophyGold)" />
      <path d="m90 64 6 13 14 2-10 10 3 14-13-7-13 7 3-14-10-10 14-2 6-13Z" fill="#fff4bd" />
    </svg>
  );
}

