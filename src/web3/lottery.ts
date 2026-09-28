import { AbiCoder, Contract } from 'ethers';
import { LOTTERY_ABI } from '../contracts/lotteryAbi';
import type { ChainConfig, LotterySnapshot } from '../types';
import { RpcManager } from './rpc';
import { formatUsdt } from './amounts';
export async function readLottery(chain: ChainConfig): Promise<LotterySnapshot> {
  if (chain.contracts.status !== 'verified' || !chain.contracts.lottery) throw new Error(`${chain.name} contract is awaiting verification.`);
  return new RpcManager(chain).request(async provider => {
    const c = new Contract(chain.contracts.lottery!, LOTTERY_ABI, provider);
    const roundId = await c.currentRoundId() as bigint;
    const [round, jackpot, upkeep] = await Promise.all([c.rounds(roundId), c.jackpotReserve() as Promise<bigint>, c.checkUpkeep('0x') as Promise<[boolean, string]>]);
    const actionNames = ['CLOSE', 'REQUEST', 'SETTLE', 'OPEN_NEXT'] as const;
    const upkeepAction = upkeep[0] && upkeep[1] !== '0x'
      ? actionNames[Number(AbiCoder.defaultAbiCoder().decode(['uint256', 'uint8', 'uint256'], upkeep[1])[1])]
      : undefined;
    return { ticketPrice: round.ticketPrice as bigint, jackpot, weeklyPool: round.weeklyPool as bigint, currentBets: round.ticketCount as bigint, roundId, closesAt: new Date(Number(round.cutoffAt) * 1000), sold: round.ticketCount as bigint, roundState: Number(round.state), upkeepAction };
  });
}
export const displayToken = formatUsdt;
