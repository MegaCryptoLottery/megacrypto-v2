# MegaCrypto Lottery V2

A security-first, responsive Web3 lottery frontend. It deliberately shows **unavailable** until a deployment can be verified; it does not manufacture balances, rounds, history, prices, addresses, or transaction outcomes.

## Run

```bash
npm install
copy .env.example .env.local
npm run dev
```

`npm run build` performs strict TypeScript checking and creates the production bundle.

## Architecture

| Area | Location | Responsibility |
|---|---|---|
| Chain registry | `src/config/chains.ts` | Chain IDs, explorers, RPC endpoint list, verified deployment status |
| Contract surface | `src/contracts/lotteryAbi.ts` | Minimal ABI reviewed against the deployed source |
| RPC resilience | `src/web3/rpc.ts` | Per-provider timeout, retries, and fallback sequence |
| Wallet lifecycle | `src/web3/wallet.ts` | Browser-wallet connection, reconnect, account/network/disconnect listeners |
| Read + events | `src/web3/lottery.ts`, `src/web3/events.ts` | Contract reads and bounded, chunked historical event scans |
| Transactions | `src/web3/transactions.ts` | Contract price read, `estimateGas`, explicit review, send/wait, friendly errors |
| UI | `src/components`, `src/App.tsx` | Accessible responsive rendering; presentation is separate from Web3 actions |

## Production V2 contract registry

The following V2 deployments are the active frontend registry. The app uses the reviewed production-candidate ABI: `buyTicket(uint32)`, `currentRoundId()`, `rounds(roundId)`, `jackpotReserve()`, and V2 ticket/settlement events. A ticket is a `uint32` mask where numbers 1–25 map to bits 1–25; bit 0 is never a lottery number.

| Network | ID | Lottery | USDT | Status |
|---|---:|---|---|---|
| Polygon | 137 | `0x24e203eB34A5B095aB892cA1CBfD8B01F8D1Ec1e` | `0xc2132D05D31c914a87C6611C10748AEb04B58e8F` | Production V2 configured |
| BNB Chain | 56 | `0x06778A545085f703bfaD5BfeCc619E7bc4F0Dd2D` | `0x55d398326f99059fF775485246999027B3197955` | Production V2 configured |
| Arbitrum One | 42161 | `0x91AaCA953ff5C12c69629bD2813b2e931f03e63C` | `0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9` | Production V2 configured |
| Base | 8453 | `0xBACd528df4c99ED77A8F143ca15cdB2795ac0D58` | `0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2` | Production V2 configured |
| Optimism | 10 | `0xc6dA7Edc75995595dD82a941C0D7b559F8f5Aa98` | `0x94b008aA00579c1307B0EF2c499aD98a8ce58e58` | Production V2 configured |
| Avalanche | 43114 | `0x91AaCA953ff5C12c69629bD2813b2e931f03e63C` | `0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7` | Production V2 configured |

Arbitrum One and Avalanche intentionally share the same deployed address, but are distinct deployments because chain ID is part of contract identity. Ticket price and the active cutoff are always read from the current on-chain V2 round. The BNB deployment uses 18-decimal USDT; the other listed deployments use 6 decimals.

Historical deployment blocks and per-chain VRF evidence for these new V2 addresses are not guessed. Draw and winner history remain explicitly pending until those start blocks are independently audited; the UI does not query legacy getters or scan from block zero.

The read-only dashboard’s exact supported data, bounded-history limits, and intentionally unavailable metrics are documented in [`docs/live-data-capabilities.md`](docs/live-data-capabilities.md).

The independently evidenced deployment blocks, bounded `SorteioRealizado` scan design, mask semantics, and per-network Chainlink VRF audit are documented in [`docs/draw-history-vrf-audit.md`](docs/draw-history-vrf-audit.md).

The read-only assessment of whether the existing deployments can safely support scheduled draw automation is documented in [`docs/draw-automation-audit.md`](docs/draw-automation-audit.md). It deliberately leaves unverified write access, timing, role, and subscription details unresolved rather than claiming an Automation integration is safe.

The follow-up source-versus-runtime and automation-safety evidence matrix is documented in [`docs/contract-source-comparison.md`](docs/contract-source-comparison.md).

## Deployment verification gate

The source records above are centralized in `src/config/chains.ts`. To enable a disabled network, obtain and audit its independent deployment evidence, then update that chain's registry entry:

1. Set `contracts.status` to `verified`, its `lottery` and (if relevant) `token` address, and a source URL/commit.
2. Compare each ABI method and event to the verified source. Do not retain a guessed ABI.
3. Add at least one public RPC endpoint in `.env.local`; production should provide two independent endpoints.
4. Define a safe start block / persisted cursor for `scanRange`; never scan from block zero routinely.
5. Test a read on the target chain, then a wallet rejection and an intentional reverted transaction on a test deployment before enabling a production purchase flow.

## Adding a blockchain or wallet

Add a typed `ChainConfig` record to `CHAINS` with its exact chain ID, explorer, RPC environment key, and only verified contracts. The app identifies the wallet's actual `chainId` before transaction preparation. Browser-injected providers cover MetaMask, Coinbase Wallet, Trust Wallet, Rabby, and OKX where installed. WalletConnect is declared as a dependency and should be initialized with a project ID in a dedicated connector adapter before exposing it in UI; never collect recovery phrases as a workaround.

## Security notes

- Seed phrases and private keys are never requested, stored, or transmitted.
- Ticket value comes from `rounds(currentRoundId).ticketPrice` and gas comes from signer estimation for the exact populated transaction.
- Users review network, contract, payment, and estimated gas before their wallet is invoked.
- Event records must be associated through indexed `roundId` and VRF `requestId`; array position is not a source of truth.
- Final wallet confirmation is authoritative. The UI never simulates success.
