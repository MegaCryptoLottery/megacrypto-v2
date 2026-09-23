import { Contract } from 'ethers';
import { LOTTERY_ABI } from '../contracts/lotteryAbi';
import type { ChainConfig } from '../types';
import { RpcManager } from './rpc';
import { maskToNumbers } from './player';

export const EVENT_SCAN_CHUNK_SIZE = 2_000;
export const EVENT_SCAN_CHUNKS_PER_PAGE = 25;
export type DrawEvent = { chain: ChainConfig; requestId: bigint; mask: bigint; numbers: number[]; blockNumber: number; transactionHash: string; timestamp: number };
export type DrawPage = { draws: DrawEvent[]; fromBlock?: number; toBlock?: number; nextBlock?: number; complete: boolean; error?: string };
export const drawPageEnd = (fromBlock: number, latest: number) => Math.min(latest, fromBlock + EVENT_SCAN_CHUNK_SIZE * EVENT_SCAN_CHUNKS_PER_PAGE - 1);

/** Queries only an explicit, verified deployment range in small RPC pages. */
export async function readDrawPage(chain: ChainConfig, fromBlock = chain.contracts.deploymentStartBlock): Promise<DrawPage> {
  if (!chain.contracts.lottery || !fromBlock) return { draws: [], complete: true, error: 'Deployment block verification pending; draw events are not scanned.' };
  try {
    return await new RpcManager(chain).request(async (provider) => {
      const latest = await provider.getBlockNumber();
      if (fromBlock > latest) return { draws: [], fromBlock, toBlock: latest, complete: true };
      const toBlock = drawPageEnd(fromBlock, latest);
      const lottery = new Contract(chain.contracts.lottery!, LOTTERY_ABI, provider);
      const logs = [] as Awaited<ReturnType<typeof lottery.queryFilter>>;
      for (let start = fromBlock; start <= toBlock; start += EVENT_SCAN_CHUNK_SIZE) logs.push(...await lottery.queryFilter(lottery.filters.RoundSettled(), start, Math.min(start + EVENT_SCAN_CHUNK_SIZE - 1, toBlock)));
      const timestamps = new Map<number, number>();
      await Promise.all(logs.map(async (log) => { if (!timestamps.has(log.blockNumber)) timestamps.set(log.blockNumber, (await provider.getBlock(log.blockNumber))?.timestamp ?? 0); }));
      const draws = logs.map((log) => { const parsed = lottery.interface.parseLog(log); const requestId = parsed?.args.id as bigint; const mask = parsed?.args.mask as bigint; return { chain, requestId, mask, numbers: maskToNumbers(mask), blockNumber: log.blockNumber, transactionHash: log.transactionHash, timestamp: timestamps.get(log.blockNumber) ?? 0 }; });
      return { draws, fromBlock, toBlock, nextBlock: toBlock < latest ? toBlock + 1 : undefined, complete: toBlock >= latest };
    });
  } catch (error) { return { draws: [], complete: false, error: error instanceof Error ? error.message : 'RPC event query failed.' }; }
}
