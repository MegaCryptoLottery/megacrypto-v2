export type ChainKey = 'polygon' | 'bsc' | 'arbitrum' | 'base' | 'optimism' | 'avalanche';
export type ContractStatus = 'verification-required' | 'verified';
export interface ChainConfig { key: ChainKey; chainId: number; name: string; nativeCurrency: string; explorer: string; rpcUrls: string[]; contracts: { lottery?: `0x${string}`; token?: `0x${string}`; tokenSymbol: 'USDT'; tokenDecimals: number; status: ContractStatus; source?: string; note?: string } }
export interface LotterySnapshot { ticketPrice?: bigint; jackpot?: bigint; weeklyPool?: bigint; currentBets?: bigint; roundId?: bigint; closesAt?: Date; sold?: bigint }
export interface WalletState { address?: string; chainId?: number; connected: boolean; connecting: boolean; error?: string }
