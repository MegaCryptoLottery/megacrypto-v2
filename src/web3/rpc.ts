import { JsonRpcProvider } from 'ethers';
import type { ChainConfig } from '../types';
const timeout = <T>(promise: Promise<T>, ms = 8_000) => Promise.race([promise, new Promise<T>((_, reject) => setTimeout(() => reject(new Error('RPC request timed out')), ms))]);
export class RpcManager {
  constructor(private readonly chain: ChainConfig) {}
  async request<T>(run: (provider: JsonRpcProvider) => Promise<T>): Promise<T> {
    const urls = this.chain.rpcUrls;
    if (!urls.length) throw new Error(`No RPC endpoint is configured for ${this.chain.name}.`);
    let last: unknown;
    for (const url of urls) for (let attempt = 0; attempt < 2; attempt++) try { return await timeout(run(new JsonRpcProvider(url, this.chain.chainId))); } catch (error) { last = error; }
    throw last instanceof Error ? last : new Error('All RPC providers failed.');
  }
}
