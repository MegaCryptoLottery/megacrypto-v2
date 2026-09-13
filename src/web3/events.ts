import { Contract, type Provider } from 'ethers';
import { LOTTERY_ABI } from '../contracts/lotteryAbi';
// A bounded scanner prevents unbounded “from genesis” RPC calls. Persist last scanned block per network in production.
export async function scanRange(provider: Provider, address: string, fromBlock: number, toBlock: number, onChunk: (logs: readonly unknown[]) => void, chunk = 25_000) {
  const contract = new Contract(address, LOTTERY_ABI, provider);
  for (let start = fromBlock; start <= toBlock; start += chunk) onChunk(await contract.queryFilter('*', start, Math.min(start + chunk - 1, toBlock)));
}
