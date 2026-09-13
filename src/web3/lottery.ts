import { Contract, formatUnits } from 'ethers';
import { LOTTERY_ABI } from '../contracts/lotteryAbi';
import type { ChainConfig, LotterySnapshot } from '../types';
import { RpcManager } from './rpc';
export async function readLottery(chain: ChainConfig): Promise<LotterySnapshot> {
  if (chain.contracts.status !== 'verified' || !chain.contracts.lottery) throw new Error(`${chain.name} contract is awaiting verification.`);
  return new RpcManager(chain).request(async provider => { const c = new Contract(chain.contracts.lottery!, LOTTERY_ABI, provider); const [ticketPrice, jackpot] = await Promise.all([c.precoBilhete(), c.jackpotAcumulado()]); return { ticketPrice, jackpot }; });
}
export const displayToken = (amount: bigint | undefined, decimals = 6) => amount === undefined ? '—' : Number(formatUnits(amount, decimals)).toLocaleString(undefined, { maximumFractionDigits: 4 });
