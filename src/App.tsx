import { useAppKit, useAppKitAccount, useAppKitNetwork, useAppKitProvider } from '@reown/appkit/react';
import { type Eip1193Provider } from 'ethers';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CHAINS, chainById } from './config/chains';
import { Fairness } from './components/Fairness';
import { DrawPrizePanel } from './components/DrawPrizePanel';
import { GlobalPrizeDashboard } from './components/GlobalPrizeDashboard';
import { GlobalStats } from './components/GlobalStats';
import { NetworkGrid } from './components/NetworkGrid';
import { NetworkInfoPanel } from './components/NetworkInfoPanel';
import { NumberPicker, normalizeTicketNumbers } from './components/NumberPicker';
import { TransactionReview } from './components/TransactionReview';
import { TrustBar } from './components/TrustBar';
import { PlayerDashboard } from './components/PlayerDashboard';
import { WinnerHistory } from './components/WinnerHistory';
import { DrawHistory } from './components/DrawHistory';
import type { ChainKey, LotterySnapshot, WalletState } from './types';
import { displayToken, readLottery } from './web3/lottery';
import { friendlyError, prepareTicketPurchase, submitReviewed, type TransactionReview as Review } from './web3/transactions';
import { appKitNetworkByChainId, ensureAppKitModal } from './web3/appkit';
import { WalletController } from './web3/wallet';
import { readSelectedNetworkState, type SelectedNetworkState } from './web3/player';

const navigationItems = [
  ['#play', 'Play'], ['#fairness', 'How It Works'], ['#draws', 'Draws'], ['#winners', 'Winners'], ['#tickets', 'My Tickets'], ['#stats', 'Stats'], ['#faq', 'FAQ'],
] as const;

export default function App() {
  const [selected, setSelected] = useState<ChainKey>('polygon');
  const [wallet, setWallet] = useState<WalletState>({ connected: false, connecting: false });
  const [snapshot, setSnapshot] = useState<LotterySnapshot>({});
  const [numbers, setNumbers] = useState<number[]>([]);
  const [status, setStatus] = useState('Select a verified network to view live on-chain data.');
  const [review, setReview] = useState<Review>();
  const [busy, setBusy] = useState(false);
  const [playerState, setPlayerState] = useState<SelectedNetworkState>();
  const [liveRefresh, setLiveRefresh] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<Date>();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const firstMobileLink = useRef<HTMLAnchorElement>(null);
  const controller = useMemo(() => new WalletController(setWallet), []);
  const { address, isConnected, status: connectionStatus } = useAppKitAccount();
  const { open: openAppKit } = useAppKit();
  const { chainId, switchNetwork } = useAppKitNetwork();
  const { walletProvider } = useAppKitProvider<Eip1193Provider>('eip155');
  const chain = CHAINS[selected];

  useEffect(() => {
    controller.syncAppKit({
      address,
      chainId: typeof chainId === 'number' ? chainId : Number(chainId),
      connected: isConnected,
      connecting: connectionStatus === 'connecting' || connectionStatus === 'reconnecting',
      provider: walletProvider,
    });
  }, [address, chainId, connectionStatus, controller, isConnected, walletProvider]);
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setMobileMenuOpen(false); };
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKeyDown);
    window.setTimeout(() => firstMobileLink.current?.focus(), 0);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', onKeyDown); };
  }, [mobileMenuOpen]);
  useEffect(() => {
    setSnapshot({});
    setPlayerState(undefined);
    Promise.all([readLottery(chain), readSelectedNetworkState(chain, wallet.address)])
      .then(([next, nextPlayerState]) => {
        setSnapshot(next);
        setPlayerState(nextPlayerState);
        setLastUpdated(new Date());
        setStatus('Live contract data');
      })
      .catch((error) => setStatus(error.message));
  }, [chain, liveRefresh, wallet.address]);

  const connect = async () => {
    try {
      ensureAppKitModal();
      await openAppKit({ view: wallet.connected ? 'Account' : 'Connect' });
      if (!document.querySelector('w3m-modal')) throw new Error('The Reown wallet interface could not be displayed.');
    } catch (error) {
      const message = friendlyError(error);
      setWallet({ connected: false, connecting: false, error: message });
      setStatus(`Wallet connection unavailable: ${message}`);
    }
  };

  const reviewTicket = async () => {
    try {
      const ticket = normalizeTicketNumbers(numbers);
      if (chain.contracts.status !== 'verified') return void setStatus(chain.contracts.note ?? 'Verification Required.');
      if (!wallet.connected) return void setStatus('Connect a wallet before reviewing a ticket.');
      if (wallet.chainId !== chain.chainId) {
        const targetNetwork = appKitNetworkByChainId.get(chain.chainId);
        if (!targetNetwork) return void setStatus(`${chain.name} is unavailable for wallet switching.`);
        setStatus(`Switch your wallet to ${chain.name} before reviewing a ticket.`);
        await switchNetwork(targetNetwork);
        return;
      }
      setReview(await prepareTicketPurchase(chain, controller.getProvider(), ticket));
    } catch (error) { setStatus(friendlyError(error)); }
  };

  const confirm = async () => {
    if (!review || !controller.getProvider()) return;
    try {
      setBusy(true);
      const receipt = await submitReviewed(controller.getProvider()!, review);
      setStatus(review.kind === 'approval'
        ? `USDT approval confirmed in block ${receipt?.blockNumber ?? 'pending'}. Review the ticket transaction next.`
        : `Ticket confirmed in block ${receipt?.blockNumber ?? 'pending'}.`);
      setReview(undefined);
      if (review.kind === 'ticket') setNumbers([]);
      setLiveRefresh((version) => version + 1);
    } catch (error) { setStatus(friendlyError(error)); }
    finally { setBusy(false); }
  };

  const activeChain = chainById(wallet.chainId);
  return (
    <div className="app-shell">
      <header className="section-shell app-header">
      <nav className="content-container">
        <a className="brand" href="#top"><img className="brand-crown" src={`${import.meta.env.BASE_URL}assets/brand/megacrypto-crown.webp`} alt="" aria-hidden="true" style={{ width: 'clamp(42px, 4vw, 58px)', height: 'clamp(42px, 4vw, 58px)', objectFit: 'contain' }} /><span>MEGA<em>CRYPTO</em><b>LOTTERY</b></span><i>V2</i></a>
        <div className="nav-links" aria-label="Primary navigation">{navigationItems.map(([href, label]) => <a key={href} href={href}>{label}</a>)}</div>
        <div className="nav-status">
          <label className="network-select"><span className="sr-only">Selected network</span><select value={selected} onChange={(event) => setSelected(event.target.value as ChainKey)}>{Object.values(CHAINS).map((item) => <option key={item.key} value={item.key}>{item.name}</option>)}</select></label>
          <span className={wallet.connected ? 'dot live' : 'dot'} />
          {wallet.connected ? `${wallet.address!.slice(0, 6)}…${wallet.address!.slice(-4)}` : 'Not connected'}
          <button onClick={connect} disabled={wallet.connecting}>
            {wallet.connecting ? 'Connecting…' : wallet.connected ? 'Manage Wallet' : 'Connect wallet'}
          </button>
        </div>
        <button className="mobile-menu-toggle" type="button" aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'} aria-expanded={mobileMenuOpen} aria-controls="mobile-navigation" onClick={() => setMobileMenuOpen((open) => !open)}><span /><span /><span /></button>
      </nav>
      </header>
      {mobileMenuOpen && <div className="mobile-nav-layer">
        <button className="mobile-nav-backdrop" type="button" aria-label="Close navigation menu" onClick={() => setMobileMenuOpen(false)} />
        <nav id="mobile-navigation" className="mobile-nav-drawer" aria-label="Mobile navigation">
          <p>Explore MegaCrypto Lottery</p>
          {navigationItems.map(([href, label], index) => <a key={href} ref={index === 0 ? firstMobileLink : undefined} href={href} onClick={() => setMobileMenuOpen(false)}>{label}<span aria-hidden="true">→</span></a>)}
        </nav>
      </div>}

      <div role="main" className="content-container">
      <GlobalPrizeDashboard refreshKey={liveRefresh} />
      <div id="stats"><GlobalStats selectedState={playerState} /></div>

      <div className="live-status-row"><p id="top" className="status" role="status">
        {status}{lastUpdated ? ` · Last updated: ${lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : ''}{wallet.connected && activeChain && activeChain.key !== selected ? ` · Wallet is on ${activeChain.name}` : ''}
      </p><button className="refresh-live-data" type="button" onClick={() => setLiveRefresh((version) => version + 1)}>Refresh live data</button></div>
      <section id="play" className="game-section" aria-label="Play MegaCrypto Lottery">
        <div className="play-layout">
          <NetworkInfoPanel chain={chain} ticketPrice={displayToken(snapshot.ticketPrice, chain.contracts.tokenDecimals)} />
          <div className="play-picker"><NumberPicker value={numbers} onChange={setNumbers} /></div>
          <DrawPrizePanel network={chain.name} chainId={chain.chainId} jackpot={displayToken(snapshot.jackpot, chain.contracts.tokenDecimals)} weeklyPool={displayToken(snapshot.weeklyPool, chain.contracts.tokenDecimals)} ticketPrice={displayToken(snapshot.ticketPrice, chain.contracts.tokenDecimals)} numbers={numbers} closesAt={snapshot.closesAt} />
        </div>
        <button className="review-ticket" disabled={numbers.length !== 15} onClick={reviewTicket}>Continue to transaction review <span>→</span></button>
      </section>
      <NetworkGrid selected={selected} onSelect={setSelected} />
      <PlayerDashboard chain={chain} state={playerState} wallet={wallet.address} />
      <WinnerHistory refreshKey={liveRefresh} />
      <DrawHistory refreshKey={liveRefresh} />
      <div id="fairness"><Fairness /></div>
      <TrustBar />
      </div>
      <footer className="section-shell app-footer"><div className="content-container">© 2026 MegaCrypto Lottery · This app never asks for a recovery phrase or private key.</div></footer>
      {review && <TransactionReview review={review} onCancel={() => setReview(undefined)} onConfirm={confirm} busy={busy} />}
    </div>
  );
}
