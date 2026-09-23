import { Contract } from 'ethers';
import { CHAINS } from '../config/chains';
import { LOTTERY_ABI } from '../contracts/lotteryAbi';
import { RpcManager } from './rpc';
import type { ChainConfig } from '../types';
import { normalizeUsdt } from './amounts';

export interface NetworkPrizeState { chain: ChainConfig; jackpot?: bigint; weekly?: bigint; jackpotUsdt?: bigint; weeklyUsdt?: bigint; error?: string }
export async function readNetworkPrizes(chain: ChainConfig): Promise<NetworkPrizeState> {
  try { const result = await new RpcManager(chain).request(async provider => {
    const lottery = new Contract(chain.contracts.lottery!, LOTTERY_ABI, provider);
    const roundId = await lottery.currentRoundId() as bigint;
    const [round, jackpot] = await Promise.all([lottery.rounds(roundId), lottery.jackpotReserve() as Promise<bigint>]);
    const weekly = round.weeklyPool as bigint;
    return { jackpot, weekly, jackpotUsdt: normalizeUsdt(jackpot, chain.contracts.tokenDecimals), weeklyUsdt: normalizeUsdt(weekly, chain.contracts.tokenDecimals) };
  }); return { chain, ...result }; } catch (error) { return { chain, error: error instanceof Error ? error.message : 'RPC unavailable' }; }
}
export async function readGlobalPrizes() {
  const networks = await Promise.all(Object.values(CHAINS).map(readNetworkPrizes));
  const available = networks.filter(x => x.jackpotUsdt !== undefined && x.weeklyUsdt !== undefined);
  return { networks, available: available.length, jackpot: available.reduce((sum, x) => sum + x.jackpotUsdt!, 0n), weekly: available.reduce((sum, x) => sum + x.weeklyUsdt!, 0n) };
}
