import { Contract } from 'ethers';
import { CHAINS } from '../config/chains';
import { LOTTERY_ABI } from '../contracts/lotteryAbi';
import { RpcManager } from './rpc';
import type { ChainConfig } from '../types';

export interface NetworkPrizeState { chain: ChainConfig; jackpot?: bigint; weekly?: bigint; error?: string }
const toMicroUsdt = (value: bigint, decimals: number) => decimals >= 6 ? value / 10n ** BigInt(decimals - 6) : value * 10n ** BigInt(6 - decimals);
export async function readNetworkPrizes(chain: ChainConfig): Promise<NetworkPrizeState> {
  try { const result = await new RpcManager(chain).request(async provider => { const lottery = new Contract(chain.contracts.lottery!, LOTTERY_ABI, provider); const [jackpot, weekly] = await Promise.all([lottery.jackpotAcumulado(), lottery.poolSemanal()]); return { jackpot, weekly }; }); return { chain, ...result }; } catch (error) { return { chain, error: error instanceof Error ? error.message : 'RPC unavailable' }; }
}
export async function readGlobalPrizes() {
  const networks = await Promise.all(Object.values(CHAINS).map(readNetworkPrizes));
  const available = networks.filter(x => x.jackpot !== undefined && x.weekly !== undefined);
  return { networks, available: available.length, jackpot: available.reduce((sum, x) => sum + toMicroUsdt(x.jackpot!, x.chain.contracts.tokenDecimals), 0n), weekly: available.reduce((sum, x) => sum + toMicroUsdt(x.weekly!, x.chain.contracts.tokenDecimals), 0n) };
}

