import { Contract } from 'ethers';
import { LOTTERY_ABI } from '../contracts/lotteryAbi';
import type { ChainConfig, LotterySnapshot } from '../types';
import { RpcManager } from './rpc';
import { formatUsdt } from './amounts';
export async function readLottery(chain: ChainConfig): Promise<LotterySnapshot> {
  if (chain.contracts.status !== 'verified' || !chain.contracts.lottery) throw new Error(`${chain.name} contract is awaiting verification.`);
  return new RpcManager(chain).request(async provider => {
    const c = new Contract(chain.contracts.lottery!, LOTTERY_ABI, provider);
    const roundId = await c.currentRoundId() as bigint;
    const [round, jackpot] = await Promise.all([c.rounds(roundId), c.jackpotReserve() as Promise<bigint>]);
    return { ticketPrice: round.ticketPrice as bigint, jackpot, weeklyPool: round.weeklyPool as bigint, currentBets: round.ticketCount as bigint, roundId, closesAt: new Date(Number(round.cutoffAt) * 1000), sold: round.ticketCount as bigint };
  });
}
export const displayToken = formatUsdt;
