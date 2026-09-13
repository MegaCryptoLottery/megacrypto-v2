import type { ChainConfig, ChainKey } from '../types';
const env = import.meta.env;
const source = 'https://github.com/MegaCryptoLottery/megacrypto/blob/c0f8e4cebccf97bf84f6cc73308d8fceda70471d/index.html#L527-L605';
const config = (key: ChainKey, chainId: number, name: string, nativeCurrency: string, explorer: string, defaults: string[], lottery: `0x${string}`, token: `0x${string}`, tokenDecimals: number, status: ChainConfig['contracts']['status'] = 'verified', note?: string): ChainConfig => ({ key, chainId, name, nativeCurrency, explorer, rpcUrls: [env[`VITE_${key.toUpperCase()}_RPC_URL`], ...defaults].filter(Boolean), contracts: { lottery, token, tokenSymbol: 'USDT', tokenDecimals, status, source, note } });
// Imported verbatim from the original public frontend commit shown in `source`.
export const CHAINS: Record<ChainKey, ChainConfig> = {
  polygon: config('polygon', 137, 'Polygon', 'POL', 'https://polygonscan.com', ['https://polygon-bor-rpc.publicnode.com', 'https://polygon-rpc.com'], '0x171cc5E40fDeF437DF062D36d082E92eE41b132C', '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', 6),
  bsc: config('bsc', 56, 'BNB Smart Chain', 'BNB', 'https://bscscan.com', ['https://bsc-dataseed.binance.org', 'https://bsc-rpc.publicnode.com'], '0xC190A715ab6D4B63fF59501460e9f27D16FfAC33', '0x55d398326f99059fF775485246999027B3197955', 18),
  arbitrum: config('arbitrum', 42161, 'Arbitrum One', 'ETH', 'https://arbiscan.io', ['https://arb1.arbitrum.io/rpc', 'https://arbitrum-one-rpc.publicnode.com'], '0x162F0B0E205719a25542142b65967D5e686068ee', '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9', 6),
  base: config('base', 8453, 'Base', 'ETH', 'https://basescan.org', ['https://mainnet.base.org', 'https://base-rpc.publicnode.com'], '0x0fBF3A5fFE730D95611f08B6Bb315c6161c36eeB', '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2', 6),
  optimism: config('optimism', 10, 'Optimism', 'ETH', 'https://optimistic.etherscan.io', ['https://mainnet.optimism.io', 'https://optimism-rpc.publicnode.com'], '0x73B543CC94a03cb7e9DE38eb4EcAAA883b4804b0', '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58', 6),
  avalanche: config('avalanche', 43114, 'Avalanche', 'AVAX', 'https://snowtrace.io', ['https://api.avax.network/ext/bc/C/rpc', 'https://avalanche-c-chain-rpc.publicnode.com'], '0x0fBF3A5fFE730D95611f08B6Bb315c6161c36eeB', '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7', 6)
};
export const chainById = (id?: number) => Object.values(CHAINS).find(c => c.chainId === id);

