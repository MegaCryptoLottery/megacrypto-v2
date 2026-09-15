import { BrowserProvider, type Eip1193Provider } from 'ethers';
import type { WalletState } from '../types';

export type AppKitWalletSnapshot = {
  address?: string;
  chainId?: number;
  connected: boolean;
  connecting: boolean;
  provider?: Eip1193Provider;
};

/** Keeps ethers transaction calls unchanged while AppKit owns wallet sessions. */
export class WalletController {
  private provider?: BrowserProvider;

  constructor(private update: (state: WalletState) => void) {}

  syncAppKit(snapshot: AppKitWalletSnapshot) {
    if (!snapshot.connected || !snapshot.address || !snapshot.chainId || !snapshot.provider) {
      this.provider = undefined;
      this.update({ connected: false, connecting: snapshot.connecting });
      return;
    }

    this.provider = new BrowserProvider(snapshot.provider, 'any');
    this.update({ connected: true, connecting: snapshot.connecting, address: snapshot.address, chainId: snapshot.chainId });
  }

  getProvider() { return this.provider; }
}

