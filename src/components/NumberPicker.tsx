import { useEffect, useState } from 'react';

export const normalizeTicketNumbers = (numbers: number[]) => {
  const normalized = [...new Set(numbers)].sort((a, b) => a - b);
  if (normalized.length !== 15 || normalized.some((number) => !Number.isInteger(number) || number < 1 || number > 25)) {
    throw new Error('A ticket requires exactly 15 unique numbers from 1 to 25.');
  }
  return normalized;
};

function useSound() {
  const [enabled, setEnabled] = useState(() => localStorage.getItem('megacrypto_sound') !== 'off');
  useEffect(() => { localStorage.setItem('megacrypto_sound', enabled ? 'on' : 'off'); }, [enabled]);
  const tone = (frequency: number, duration = 0.06) => {
    if (!enabled) return;
    try {
      const context = new AudioContext();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.04, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + duration);
    } catch { /* Audio is optional. */ }
  };
  return { enabled, setEnabled, tone };
}

export function NumberPicker({ value, onChange }: { value: number[]; onChange: (numbers: number[]) => void }) {
  const { enabled, setEnabled, tone } = useSound();
  const toggle = (number: number) => {
    if (value.includes(number)) { onChange(value.filter((entry) => entry !== number)); tone(280); }
    else if (value.length < 15) { const next = [...value, number]; onChange(next); tone(next.length === 15 ? 740 : 510); }
    else tone(150);
  };
  const lucky = () => {
    const pool = Array.from({ length: 25 }, (_, index) => index + 1);
    const next: number[] = [];
    while (next.length < 15) next.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    onChange(next.sort((left, right) => left - right));
    tone(660, 0.12);
  };

  return (
    <section className="panel picker" aria-labelledby="ticket-title">
      <div className="section-heading">
        <div><p className="eyebrow">YOUR TICKET</p><h2 id="ticket-title">Choose 15 numbers</h2></div>
        <div className="picker-tools">
          <span className={value.length === 15 ? 'ready-count' : 'muted'}>{value.length} / 15 selected</span>
          <button className="icon-button" aria-label={enabled ? 'Mute sounds' : 'Enable sounds'} onClick={() => setEnabled(!enabled)}>{enabled ? '🔊' : '🔇'}</button>
        </div>
      </div>
      <div className="number-grid">
        {Array.from({ length: 25 }, (_, index) => index + 1).map((number) => (
          <button key={number} className={value.includes(number) ? 'picked' : ''} aria-pressed={value.includes(number)} onClick={() => toggle(number)}>{String(number).padStart(2, '0')}</button>
        ))}
      </div>
      <div className="picker-actions">
        <button className="secondary" onClick={() => { onChange([]); tone(220); }} disabled={!value.length}>Clear</button>
        <button className="secondary" onClick={lucky}>Lucky pick</button>
        <span>{value.length === 15 ? 'Your ticket is ready for review.' : 'Choose 15 unique numbers to continue.'}</span>
      </div>
    </section>
  );
}
