import { useEffect, useMemo, useState } from 'react';
import { CHAINS, chainById } from './config/chains';
import { Fairness } from './components/Fairness';
import { DrawPrizePanel } from './components/DrawPrizePanel';
import { GlobalPrizeDashboard } from './components/GlobalPrizeDashboard';
import { GlobalStats } from './components/GlobalStats';
import { NetworkGrid } from './components/NetworkGrid';
import { NetworkInfoPanel } from './components/NetworkInfoPanel';
import { NumberPicker, normalizeTicketNumbers } from './components/NumberPicker';
import { TransactionReview } from './components/TransactionReview';
import type { ChainKey, LotterySnapshot, WalletState } from './types';
import { displayToken, readLottery } from './web3/lottery';
import { friendlyError, prepareTicketPurchase, submitReviewed, type TransactionReview as Review } from './web3/transactions';
import { WalletController } from './web3/wallet';

export default function App() {
  const [selected, setSelected] = useState<ChainKey>('polygon');
  const [wallet, setWallet] = useState<WalletState>({ connected: false, connecting: false });
  const [snapshot, setSnapshot] = useState<LotterySnapshot>({});
  const [numbers, setNumbers] = useState<number[]>([]);
  const [status, setStatus] = useState('Select a verified network to view live on-chain data.');
  const [review, setReview] = useState<Review>();
  const [busy, setBusy] = useState(false);
  const controller = useMemo(() => new WalletController(setWallet), []);
  const chain = CHAINS[selected];

  useEffect(() => { controller.reconnect().catch(() => undefined); }, [controller]);
  useEffect(() => {
    setSnapshot({});
    readLottery(chain)
      .then((next) => { setSnapshot(next); setStatus('Live contract data'); })
      .catch((error) => setStatus(error.message));
  }, [chain]);

  const connect = async () => {
    try { await controller.connect(); }
    catch (error) { setWallet({ connected: false, connecting: false, error: friendlyError(error) }); }
  };

  const reviewTicket = async () => {
    try {
      const ticket = normalizeTicketNumbers(numbers);
      if (chain.contracts.status !== 'verified') return void setStatus(chain.contracts.note ?? 'Verification Required.');
      if (!wallet.connected) return void setStatus('Connect a wallet before reviewing a ticket.');
      if (wallet.chainId !== chain.chainId) return void setStatus(`Switch your wallet to ${chain.name}.`);
      setReview(await prepareTicketPurchase(chain, controller.getProvider(), ticket));
    } catch (error) { setStatus(friendlyError(error)); }
  };

  const confirm = async () => {
    if (!review || !controller.getProvider()) return;
    try {
      setBusy(true);
      const receipt = await submitReviewed(controller.getProvider()!, review.request);
      setStatus(review.kind === 'approval'
        ? `USDT approval confirmed in block ${receipt?.blockNumber ?? 'pending'}. Review the ticket transaction next.`
        : `Ticket confirmed in block ${receipt?.blockNumber ?? 'pending'}.`);
      setReview(undefined);
      if (review.kind === 'ticket') setNumbers([]);
    } catch (error) { setStatus(friendlyError(error)); }
    finally { setBusy(false); }
  };

  const activeChain = chainById(wallet.chainId);
  return (
    <main>
      <nav>
        <a className="brand" href="#top">MEGA<span>CRYPTO</span><i>V2</i></a>
        <div className="nav-links" aria-label="Primary navigation">
          <a href="#play">Play</a><a href="#fairness">How It Works</a><a href="#draws">Draws</a><a href="#winners">Winners</a><a href="#tickets">My Tickets</a><a href="#stats">Stats</a><a href="#faq">FAQ</a>
        </div>
        <div className="nav-status">
          <label className="network-select"><span className="sr-only">Selected network</span><select value={selected} onChange={(event) => setSelected(event.target.value as ChainKey)}>{Object.values(CHAINS).map((item) => <option key={item.key} value={item.key}>{item.name}</option>)}</select></label>
          <span className={wallet.connected ? 'dot live' : 'dot'} />
          {wallet.connected ? `${wallet.address!.slice(0, 6)}…${wallet.address!.slice(-4)}` : 'Not connected'}
          <button onClick={connect} disabled={wallet.connecting}>
            {wallet.connecting ? 'Connecting…' : wallet.connected ? 'Wallet connected' : 'Connect wallet'}
          </button>
        </div>
      </nav>

      <GlobalPrizeDashboard />
      <div id="stats"><GlobalStats /></div>

      <header id="top" className="play-intro"><p className="eyebrow">DECENTRALIZED • TRANSPARENT • MULTI-CHAIN</p><h1>Choose with confidence.<br /><em>Play with proof.</em></h1><p>Every on-chain value is read live. Review every transaction in your wallet before it is sent.</p></header>
      <p className="status" role="status">
        {status}{wallet.connected && activeChain && activeChain.key !== selected ? ` · Wallet is on ${activeChain.name}` : ''}
      </p>
      <section id="play" className="play-layout" aria-label="Play MegaCrypto Lottery">
        <NetworkInfoPanel chain={chain} ticketPrice={displayToken(snapshot.ticketPrice, chain.contracts.tokenDecimals)} />
        <div className="play-picker"><NumberPicker value={numbers} onChange={setNumbers} /><button className="review-ticket" disabled={numbers.length !== 15} onClick={reviewTicket}>Continue to transaction review <span>→</span></button></div>
        <DrawPrizePanel network={chain.name} jackpot={displayToken(snapshot.jackpot, chain.contracts.tokenDecimals)} ticketPrice={displayToken(snapshot.ticketPrice, chain.contracts.tokenDecimals)} />
      </section>
      <NetworkGrid selected={selected} onSelect={setSelected} />
      <section className="cards" aria-label="Lottery records">
        <article id="tickets" className="panel"><p className="eyebrow">YOUR POSITION</p><h2>Tickets & rewards</h2><p className="empty">Connect a wallet to read your verified ticket and reward state.</p></article>
        <article id="draws" className="panel"><p className="eyebrow">DRAW HISTORY</p><h2>Public, not simulated</h2><p className="empty">Historic rounds are only shown from bounded on-chain event queries.</p></article>
      </section>
      <div id="winners" className="sr-only">Winner records are unavailable until verified event-backed history is displayed.</div>
      <div id="fairness"><Fairness /></div>
      <footer>© 2026 MegaCrypto Lottery · This app never asks for a recovery phrase or private key.</footer>
      {review && <TransactionReview review={review} onCancel={() => setReview(undefined)} onConfirm={confirm} busy={busy} />}
    </main>
  );
}

