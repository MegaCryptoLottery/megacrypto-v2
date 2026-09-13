import { BrowserProvider, type Eip1193Provider } from 'ethers';
import type { WalletState } from '../types';
type InjectedProvider = Eip1193Provider & { on?: (event: 'accountsChanged' | 'chainChanged' | 'disconnect', handler: (value?: unknown) => void) => void };
declare global { interface Window { ethereum?: InjectedProvider } }
export class WalletController {
  private provider?: BrowserProvider;
  constructor(private update: (state: WalletState) => void) {}
  async connect() {
    if (!window.ethereum) throw new Error('No browser wallet was detected. Install MetaMask, Coinbase Wallet, Trust Wallet, Rabby, OKX, or connect with WalletConnect.');
    this.update({ connected: false, connecting: true });
    this.provider = new BrowserProvider(window.ethereum);
    const accounts = await this.provider.send('eth_requestAccounts', []);
    await this.sync(accounts[0]);
    window.ethereum.on?.('accountsChanged', (value?: unknown) => { const next = Array.isArray(value) ? value as string[] : []; next[0] ? this.sync(next[0]) : this.update({ connected: false, connecting: false }); });
    window.ethereum.on?.('chainChanged', () => this.reconnect());
    window.ethereum.on?.('disconnect', () => this.update({ connected: false, connecting: false }));
  }
  async reconnect() { if (!window.ethereum) return; this.provider = new BrowserProvider(window.ethereum); const accounts = await this.provider.send('eth_accounts', []); if (accounts[0]) await this.sync(accounts[0]); }
  private async sync(address: string) { const network = await this.provider!.getNetwork(); this.update({ connected: true, connecting: false, address, chainId: Number(network.chainId) }); }
  getProvider() { return this.provider; }
}
