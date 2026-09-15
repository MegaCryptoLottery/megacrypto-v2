import { Contract } from 'ethers';
import { LOTTERY_ABI } from '../contracts/lotteryAbi';
import type { ChainConfig, LotterySnapshot } from '../types';
import { RpcManager } from './rpc';
import { formatUsdt } from './amounts';
export async function readLottery(chain: ChainConfig): Promise<LotterySnapshot> {
  if (chain.contracts.status !== 'verified' || !chain.contracts.lottery) throw new Error(`${chain.name} contract is awaiting verification.`);
  return new RpcManager(chain).request(async provider => { const c = new Contract(chain.contracts.lottery!, LOTTERY_ABI, provider); const [ticketPrice, jackpot, weeklyPool, currentBets] = await Promise.all([c.precoBilhete(), c.jackpotAcumulado(), c.poolSemanal(), c.getApostasCount()]); return { ticketPrice, jackpot, weeklyPool, currentBets }; });
}
export const displayToken = formatUsdt;
