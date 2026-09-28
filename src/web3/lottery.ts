import { AbiCoder, Contract } from 'ethers';
import { LOTTERY_ABI } from '../contracts/lotteryAbi';
import type { ChainConfig, LotterySnapshot } from '../types';
import { RpcManager } from './rpc';
import { formatUsdt } from './amounts';
const actionNames = ['CLOSE', 'REQUEST', 'SETTLE', 'OPEN_NEXT'] as const;
export function decodeUpkeepAction(needed: boolean, performData: string): typeof actionNames[number] | undefined {
  if (!needed || performData === '0x') return undefined;
  return actionNames[Number(AbiCoder.defaultAbiCoder().decode(['uint256', 'uint8', 'uint256'], performData)[1])];
}
export async function readLottery(chain: ChainConfig): Promise<LotterySnapshot> {
  if (chain.contracts.status !== 'verified' || !chain.contracts.lottery) throw new Error(`${chain.name} contract is awaiting verification.`);
  return new RpcManager(chain).request(async provider => {
    const c = new Contract(chain.contracts.lottery!, LOTTERY_ABI, provider);
    const roundId = await c.currentRoundId() as bigint;
    const [round, jackpot, upkeep, blockNumber] = await Promise.all([c.rounds(roundId), c.jackpotReserve() as Promise<bigint>, c.checkUpkeep('0x') as Promise<[boolean, string]>, provider.getBlockNumber()]);
    const upkeepAction = decodeUpkeepAction(upkeep[0], upkeep[1]);
    return { ticketPrice: round.ticketPrice as bigint, jackpot, weeklyPool: round.weeklyPool as bigint, currentBets: round.ticketCount as bigint, roundId, closesAt: new Date(Number(round.cutoffAt) * 1000), sold: round.ticketCount as bigint, roundState: Number(round.state), upkeepAction, blockNumber, lastSuccessfulUpdate: Date.now() };
  });
}
export const displayToken = formatUsdt;
