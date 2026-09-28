import { Contract } from 'ethers';
import { CHAINS } from '../config/chains';
import { LOTTERY_ABI } from '../contracts/lotteryAbi';
import { RpcManager } from './rpc';
import type { ChainConfig } from '../types';
import { normalizeUsdt } from './amounts';

export interface NetworkPrizeState { chain: ChainConfig; jackpot?: bigint; weekly?: bigint; jackpotUsdt?: bigint; weeklyUsdt?: bigint; blockNumber?: number; lastAttempt: number; lastSuccessfulUpdate?: number; status: 'live' | 'error'; error?: string }
export async function readNetworkPrizes(chain: ChainConfig): Promise<NetworkPrizeState> {
  const lastAttempt = Date.now();
  try { const result = await new RpcManager(chain).request(async provider => {
    const lottery = new Contract(chain.contracts.lottery!, LOTTERY_ABI, provider);
    const [roundId, blockNumber] = await Promise.all([lottery.currentRoundId() as Promise<bigint>, provider.getBlockNumber()]);
    const [round, jackpot] = await Promise.all([lottery.rounds(roundId), lottery.jackpotReserve() as Promise<bigint>]);
    const weekly = round.weeklyPool as bigint;
    return { jackpot, weekly, blockNumber, jackpotUsdt: normalizeUsdt(jackpot, chain.contracts.tokenDecimals), weeklyUsdt: normalizeUsdt(weekly, chain.contracts.tokenDecimals) };
  }); return { chain, lastAttempt, lastSuccessfulUpdate: Date.now(), status: 'live', ...result }; } catch (error) { return { chain, lastAttempt, status: 'error', error: error instanceof Error ? error.message : 'RPC unavailable' }; }
}
export async function readGlobalPrizes() {
  const networks = await Promise.all(Object.values(CHAINS).map(readNetworkPrizes));
  return { networks, ...aggregateNetworkPrizes(networks) };
}
/** Aggregates only successful canonical-USDT reads; failed networks are explicit. */
export function aggregateNetworkPrizes(networks: NetworkPrizeState[]) {
  const available = networks.filter(x => x.status === 'live' && x.jackpotUsdt !== undefined && x.weeklyUsdt !== undefined);
  return { available: available.length, jackpot: available.reduce((sum, x) => sum + x.jackpotUsdt!, 0n), weekly: available.reduce((sum, x) => sum + x.weeklyUsdt!, 0n) };
}
