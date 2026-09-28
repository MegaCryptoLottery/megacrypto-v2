#!/usr/bin/env node
/**
 * Read-only production dashboard audit. It never creates a signer, requests an
 * account, signs, or broadcasts a transaction. Run with: node scripts/audit-live-site-data.mjs
 */
import { Contract, JsonRpcProvider } from 'ethers';

const networks = [
  ['Polygon', 137, '0x24e203eB34A5B095aB892cA1CBfD8B01F8D1Ec1e', 6, ['https://polygon-bor-rpc.publicnode.com', 'https://polygon-rpc.com']],
  ['BNB Smart Chain', 56, '0x06778A545085f703bfaD5BfeCc619E7bc4F0Dd2D', 18, ['https://bsc-dataseed.binance.org', 'https://bsc-rpc.publicnode.com']],
  ['Arbitrum One', 42161, '0x91AaCA953ff5C12c69629bD2813b2e931f03e63C', 6, ['https://arb1.arbitrum.io/rpc', 'https://arbitrum-one-rpc.publicnode.com']],
  ['Base', 8453, '0xBACd528df4c99ED77A8F143ca15cdB2795ac0D58', 6, ['https://mainnet.base.org', 'https://base-rpc.publicnode.com']],
  ['Optimism', 10, '0xc6dA7Edc75995595dD82a941C0D7b559F8f5Aa98', 6, ['https://mainnet.optimism.io', 'https://optimism-rpc.publicnode.com']],
  ['Avalanche', 43114, '0x91AaCA953ff5C12c69629bD2813b2e931f03e63C', 6, ['https://api.avax.network/ext/bc/C/rpc', 'https://avalanche-c-chain-rpc.publicnode.com']]
];

const abi = [
  'function currentRoundId() view returns(uint256)', 'function nextTicketIndex() view returns(uint256)', 'function jackpotReserve() view returns(uint256)', 'function protectedReserves() view returns(uint256)', 'function unallocatedDustReserve() view returns(uint256)', 'function playerLiabilities() view returns(uint256)', 'function paused() view returns(bool)', 'function weeklyCutoffOffset() view returns(uint64)', 'function pendingWeeklyCutoffOffset() view returns(uint64)', 'function proposedWeeklyCutoffAt() view returns(uint64)', 'function nextWeeklyCutoff() view returns(uint64)',
  'function futureTicketPrice() view returns(uint128)', 'function futureRoundDuration() view returns(uint64)', 'function futureAllocationBps() view returns(uint16,uint16,uint16,uint16)', 'function checkUpkeep(bytes) view returns(bool,bytes)', 'function solvency() view returns(uint256,uint256,bool)',
  'function activeRoundConfig() view returns(uint128,uint64,uint16,uint16,uint16,uint16,address,address)', 'function vrfConfig(uint256) view returns(address,uint256,bytes32,uint32,uint16,uint32,bool)',
  'function rounds(uint256) view returns(uint8,uint64,uint64,uint64,uint64,uint64,uint64,uint128,uint16,uint16,uint16,uint16,address,address,uint64,uint64,uint64,uint8,uint64,uint32,uint256,bool,uint8,bytes32,bytes32,uint256,uint256,uint256,uint256)'
];

const serialize = (value) => typeof value === 'bigint' ? value.toString() : Array.isArray(value) ? value.map(serialize) : value;
async function withFallback(chainId, urls, run) {
  let last;
  for (const url of urls) {
    const provider = new JsonRpcProvider(url, chainId, { batchMaxCount: 1 });
    try {
      return await Promise.race([
        run(provider, url),
        new Promise((_, reject) => setTimeout(() => reject(new Error(`RPC timeout: ${url}`)), 12_000))
      ]);
    } catch (error) { last = error; }
    finally { provider.destroy(); }
  }
  throw last;
}
async function optional(contract, name, ...args) { try { return serialize(await contract[name](...args)); } catch (error) { return { unavailable: error instanceof Error ? error.shortMessage ?? error.message : 'unavailable' }; } }
async function audit([network, chainId, lottery, decimals, urls]) {
  try {
    return await withFallback(chainId, urls, async (provider, rpc) => {
      const contract = new Contract(lottery, abi, provider);
      const [blockNumber, currentRoundId] = await Promise.all([provider.getBlockNumber(), contract.currentRoundId()]);
      const current = await optional(contract, 'rounds', currentRoundId);
      const previous = currentRoundId > 1n ? await optional(contract, 'rounds', currentRoundId - 1n) : undefined;
      const configVersion = Array.isArray(current) ? current[28] : undefined;
      const [upkeep, solvency, reserves, dust, liabilities, nextTicketIndex, paused, nextWeeklyCutoff, weeklyCutoffOffset, pendingWeeklyCutoffOffset, proposedWeeklyCutoffAt, futureTicketPrice, futureRoundDuration, futureAllocationBps, activeRoundConfig, vrfConfig] = await Promise.all([
        optional(contract, 'checkUpkeep', '0x'), optional(contract, 'solvency'), optional(contract, 'protectedReserves'), optional(contract, 'unallocatedDustReserve'), optional(contract, 'playerLiabilities'), optional(contract, 'nextTicketIndex'), optional(contract, 'paused'), optional(contract, 'nextWeeklyCutoff'), optional(contract, 'weeklyCutoffOffset'), optional(contract, 'pendingWeeklyCutoffOffset'), optional(contract, 'proposedWeeklyCutoffAt'), optional(contract, 'futureTicketPrice'), optional(contract, 'futureRoundDuration'), optional(contract, 'futureAllocationBps'), optional(contract, 'activeRoundConfig'), configVersion === undefined ? { unavailable: 'round unavailable' } : optional(contract, 'vrfConfig', configVersion)
      ]);
      return { network, chainId, lottery, decimals, rpc, blockNumber, observedAt: new Date().toISOString(), currentRoundId: currentRoundId.toString(), currentRound: current, previousRound: previous, upkeep, jackpotReserve: await optional(contract, 'jackpotReserve'), protectedReserves: reserves, unallocatedDustReserve: dust, playerLiabilities: liabilities, solvency, nextTicketIndex, paused, nextWeeklyCutoff, weeklyCutoffOffset, pendingWeeklyCutoffOffset, proposedWeeklyCutoffAt, futureTicketPrice, futureRoundDuration, futureAllocationBps, activeRoundConfig, vrfConfig };
    });
  } catch (error) { return { network, chainId, lottery, error: error instanceof Error ? error.message : 'all RPCs failed' }; }
}

const report = await Promise.all(networks.map(audit));
console.log('MEGACRYPTO_LIVE_AUDIT (read-only; no signer or transaction capability)');
console.log(JSON.stringify(report, null, 2));
