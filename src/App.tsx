import { useAppKit, useAppKitAccount, useAppKitNetwork, useAppKitProvider } from '@reown/appkit/react';
import { type Eip1193Provider } from 'ethers';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { friendlyError, prepareClaim, prepareTicketPurchase, submitReviewed, type TransactionReview as Review } from './web3/transactions';
import { appKitNetworkByChainId, ensureAppKitModal } from './web3/appkit';
import { WalletController } from './web3/wallet';
import { readSelectedNetworkState, type ClaimableTicket, type SelectedNetworkState } from './web3/player';
import { RequestGeneration } from './web3/requestGeneration';
import { useLiveRefresh } from './hooks/useLiveRefresh';
import { languages, useI18n } from './i18n';

const navigationItems = [
  ['#play', 'play'], ['#fairness', 'how'], ['#draws', 'draws'], ['#winners', 'winners'], ['#tickets', 'tickets'], ['#stats', 'stats'], ['#faq', 'faq'],
] as const;

export default function App() {
  const { locale, setLocale, t } = useI18n();
  const [selected, setSelected] = useState<ChainKey>('polygon');
  const [wallet, setWallet] = useState<WalletState>({ connected: false, connecting: false });
  const [snapshot, setSnapshot] = useState<LotterySnapshot>({});
  const [numbers, setNumbers] = useState<number[]>([]);
  const [status, setStatus] = useState('');
  const [review, setReview] = useState<Review>();
  const [busy, setBusy] = useState(false);
  const [playerState, setPlayerState] = useState<SelectedNetworkState>();
  const [lastUpdated, setLastUpdated] = useState<Date>();
  const [lastTransaction, setLastTransaction] = useState<{ hash: string; explorer: string }>();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const firstMobileLink = useRef<HTMLAnchorElement>(null);
  const liveReadGeneration = useRef(new RequestGeneration());
  const hasLiveRead = useRef(false);
  const liveChainKey = useRef<ChainKey>();
  const { fastVersion, historyVersion, refreshNow } = useLiveRefresh();
  const onCutoffElapsed = useCallback(() => refreshNow(false), [refreshNow]);
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
    const selectedChainChanged = liveChainKey.current !== chain.key;
    liveChainKey.current = chain.key;
    if (selectedChainChanged) {
      // Never present a prior network's round or player state while the new
      // network is being read. Periodic refreshes retain the last good state.
      setSnapshot({});
      setPlayerState(undefined);
      hasLiveRead.current = false;
    }
    const generation = liveReadGeneration.current.begin();
    Promise.all([readLottery(chain), readSelectedNetworkState(chain, wallet.address)])
      .then(([next, nextPlayerState]) => {
        if (!liveReadGeneration.current.isCurrent(generation)) return;
        setSnapshot(next);
        setPlayerState(nextPlayerState);
        setLastUpdated(new Date());
        hasLiveRead.current = true;
        setStatus(t('liveContractData'));
      })
      .catch((error) => {
        if (!liveReadGeneration.current.isCurrent(generation)) return;
        setStatus(`${hasLiveRead.current ? `${t('liveDataStale')} — ` : ''}${error.message}`);
      });
    return () => { liveReadGeneration.current.invalidate(); };
  }, [chain, fastVersion, wallet.address]);

  const connect = async () => {
    try {
      ensureAppKitModal();
      await openAppKit({ view: wallet.connected ? 'Account' : 'Connect' });
      if (!document.querySelector('w3m-modal')) throw new Error('The Reown wallet interface could not be displayed.');
    } catch (error) {
      const message = friendlyError(error);
      setWallet({ connected: false, connecting: false, error: message });
      setStatus(`${t('walletUnavailable')}: ${message}`);
    }
  };

  const reviewTicket = async () => {
    try {
      const ticket = normalizeTicketNumbers(numbers);
      if (chain.contracts.status !== 'verified') return void setStatus(chain.contracts.note ?? t('verificationRequired'));
      if (!wallet.connected) return void setStatus(t('connectBeforeTicket'));
      if (wallet.chainId !== chain.chainId) {
        const targetNetwork = appKitNetworkByChainId.get(chain.chainId);
        if (!targetNetwork) return void setStatus(`${chain.name} ${t('networkUnavailable')}`);
        setStatus(`${t('switchWallet')} ${chain.name} ${t('beforeTicket')}`);
        await switchNetwork(targetNetwork);
        return;
      }
      setReview(await prepareTicketPurchase(chain, controller.getProvider(), ticket));
    } catch (error) { setStatus(friendlyError(error)); }
  };

  const reviewClaim = async (ticket: ClaimableTicket) => {
    try {
      if (!wallet.connected) return void setStatus(t('connectBeforeClaim'));
      if (wallet.chainId !== chain.chainId) {
        const targetNetwork = appKitNetworkByChainId.get(chain.chainId);
        if (!targetNetwork) return void setStatus(`${chain.name} ${t('networkUnavailable')}`);
        setStatus(`${t('switchWallet')} ${chain.name} ${t('beforeClaim')}`);
        await switchNetwork(targetNetwork);
        return;
      }
      setReview(await prepareClaim(chain, controller.getProvider(), ticket.roundId, ticket.offset));
    } catch (error) { setStatus(friendlyError(error)); }
  };

  const confirm = async () => {
    if (!review || !controller.getProvider()) return;
    try {
      setBusy(true);
      const receipt = await submitReviewed(controller.getProvider()!, review);
      const block = String(receipt?.blockNumber ?? 'pending');
      setStatus((review.kind === 'approval' ? t('approvalConfirmed') : review.kind === 'claim' ? t('claimConfirmed') : t('ticketConfirmed')).replace('{{block}}', block));
      setReview(undefined);
      if (receipt?.hash) setLastTransaction({ hash: receipt.hash, explorer: review.explorer });
      if (review.kind === 'ticket') setNumbers([]);
      refreshNow(true);
    } catch (error) { setStatus(friendlyError(error)); }
    finally { setBusy(false); }
  };

  const activeChain = chainById(wallet.chainId);
  const ticketsAvailable = snapshot.roundState === 0 && !snapshot.upkeepAction;
  return (
    <div className="app-shell">
      <header className="section-shell app-header">
      <nav className="content-container">
        <a className="brand" href="#top"><img className="brand-crown" src={`${import.meta.env.BASE_URL}assets/brand/megacrypto-crown.webp`} alt="" aria-hidden="true" style={{ width: 'clamp(42px, 4vw, 58px)', height: 'clamp(42px, 4vw, 58px)', objectFit: 'contain' }} /><span>MEGA<em>CRYPTO</em><b>LOTTERY</b></span><i>V2</i></a>
        <div className="nav-links" aria-label={t('primaryNavigation')}>{navigationItems.map(([href, label]) => <a key={href} href={href}>{t(label)}</a>)}</div>
        <div className="nav-status">
          <label className="network-select"><span className="sr-only">{t('selectedNetwork')}</span><select value={selected} onChange={(event) => setSelected(event.target.value as ChainKey)}>{Object.values(CHAINS).map((item) => <option key={item.key} value={item.key}>{item.name}</option>)}</select></label>
          <span className={wallet.connected ? 'dot live' : 'dot'} />
          {wallet.connected ? `${wallet.address!.slice(0, 6)}…${wallet.address!.slice(-4)}` : t('connected')}
          <button onClick={connect} disabled={wallet.connecting}>
            {wallet.connecting ? t('connecting') : wallet.connected ? t('manage') : t('connect')}
          </button>
          <label className="language-select"><span className="sr-only">{t('language')}</span><select value={locale} onChange={(event) => setLocale(event.target.value as typeof locale)}>{languages.map(([code, name]) => <option key={code} value={code}>{name}</option>)}</select></label>
        </div>
        <button className="mobile-menu-toggle" type="button" aria-label={mobileMenuOpen ? t('closeNavigation') : t('openNavigation')} aria-expanded={mobileMenuOpen} aria-controls="mobile-navigation" onClick={() => setMobileMenuOpen((open) => !open)}><span /><span /><span /></button>
      </nav>
      </header>
      {mobileMenuOpen && <div className="mobile-nav-layer">
        <button className="mobile-nav-backdrop" type="button" aria-label={t('closeNavigation')} onClick={() => setMobileMenuOpen(false)} />
        <nav id="mobile-navigation" className="mobile-nav-drawer" aria-label={t('mobileNavigation')}>
          <p>{t('exploreLottery')}</p>
          {navigationItems.map(([href, label], index) => <a key={href} ref={index === 0 ? firstMobileLink : undefined} href={href} onClick={() => setMobileMenuOpen(false)}>{t(label)}<span aria-hidden="true">→</span></a>)}
        </nav>
      </div>}

      <div role="main" className="content-container">
      <GlobalPrizeDashboard refreshKey={fastVersion} />
      <div id="stats"><GlobalStats selectedState={playerState} /></div>

      <div className="live-status-row"><p id="top" className="status" role="status">
        {status}{lastUpdated ? ` · ${t('lastUpdated')}: ${lastUpdated.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : ''}{wallet.connected && activeChain && activeChain.key !== selected ? ` · ${t('walletOn')} ${activeChain.name}` : ''}{lastTransaction ? <> · <a href={`${lastTransaction.explorer}/tx/${lastTransaction.hash}`} target="_blank" rel="noreferrer">{t('viewConfirmedTransaction')} ↗</a></> : ''}
      </p><button className="refresh-live-data" type="button" onClick={() => refreshNow(true)}>{t('refresh')}</button></div>
      <section id="play" className="game-section" aria-label={t('playLottery')}>
        <div className="play-layout">
          <NetworkInfoPanel chain={chain} ticketPrice={displayToken(snapshot.ticketPrice, chain.contracts.tokenDecimals)} />
          <div className="play-picker"><NumberPicker value={numbers} onChange={setNumbers} /></div>
          <DrawPrizePanel network={chain.name} chainId={chain.chainId} jackpot={displayToken(snapshot.jackpot, chain.contracts.tokenDecimals)} weeklyPool={displayToken(snapshot.weeklyPool, chain.contracts.tokenDecimals)} ticketPrice={displayToken(snapshot.ticketPrice, chain.contracts.tokenDecimals)} numbers={numbers} closesAt={snapshot.closesAt} roundState={snapshot.roundState} upkeepAction={snapshot.upkeepAction} onCutoffElapsed={onCutoffElapsed} />
        </div>
        <button className="review-ticket" disabled={numbers.length !== 15 || !ticketsAvailable} onClick={reviewTicket}>{ticketsAvailable ? t('review') : t('unavailable')} <span>→</span></button>
      </section>
      <NetworkGrid selected={selected} onSelect={setSelected} />
      <PlayerDashboard chain={chain} state={playerState} wallet={wallet.address} onReviewClaim={reviewClaim} />
      <WinnerHistory refreshKey={historyVersion} />
      <DrawHistory refreshKey={historyVersion} />
      <div id="fairness"><Fairness /></div>
      <TrustBar />
      </div>
      <footer className="section-shell app-footer"><div className="content-container">© 2026 MegaCrypto Lottery · {t('footer')}</div></footer>
      {review && <TransactionReview review={review} onCancel={() => setReview(undefined)} onConfirm={confirm} busy={busy} />}
    </div>
  );
}
