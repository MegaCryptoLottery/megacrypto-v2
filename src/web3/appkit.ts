import { createAppKit, type CaipNetwork } from '@reown/appkit/react';
import { EthersAdapter } from '@reown/appkit-adapter-ethers';
// AppKit normally loads these on first open. Registering them with the app
// bundle prevents a failed lazy chunk from becoming an invisible no-op.
import '@reown/appkit-scaffold-ui';
import '@reown/appkit-scaffold-ui/w3m-modal';
import { CHAINS } from '../config/chains';
import type { ChainConfig } from '../types';

const PROJECT_ID = import.meta.env.VITE_REOWN_PROJECT_ID || 'c25fc20a251d0c4850783b60fbc7609a';

const toAppKitNetwork = (chain: ChainConfig): CaipNetwork => ({
  id: chain.chainId,
  caipNetworkId: `eip155:${chain.chainId}`,
  chainNamespace: 'eip155',
  name: chain.name,
  nativeCurrency: { name: chain.nativeCurrency, symbol: chain.nativeCurrency, decimals: 18 },
  rpcUrls: { default: { http: chain.rpcUrls } },
  blockExplorers: { default: { name: `${chain.name} Explorer`, url: chain.explorer } },
});

// AppKit is deliberately derived from the audited MegaCrypto registry: no extra
// chains can enter the wallet flow without first being added to that registry.
export const appKitNetworks = Object.values(CHAINS).map(toAppKitNetwork) as [CaipNetwork, ...CaipNetwork[]];
export const appKitNetworkByChainId = new Map(appKitNetworks.map((network) => [Number(network.id), network]));

export const appKit = createAppKit({
  adapters: [new EthersAdapter()],
  networks: appKitNetworks,
  defaultNetwork: appKitNetworks[0],
  projectId: PROJECT_ID,
  metadata: {
    name: 'MegaCrypto Lottery',
    description: 'Multi-chain decentralized crypto lottery',
    url: 'https://megacryptolottery.github.io/megacrypto-v2/',
    icons: ['https://megacryptolottery.github.io/megacrypto-v2/assets/brand/megacrypto-crown.webp'],
  },
  allowUnsupportedChain: false,
  features: { analytics: false, email: false, socials: false },
  themeMode: 'dark',
});

export const ensureAppKitModal = () => {
  if (typeof document === 'undefined') return;
  if (!customElements.get('w3m-modal')) {
    throw new Error('The Reown wallet interface did not load. Please refresh and try again.');
  }
  if (!document.querySelector('w3m-modal')) {
    document.body.append(document.createElement('w3m-modal'));
  }
};

