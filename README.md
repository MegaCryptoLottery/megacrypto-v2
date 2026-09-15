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

## Verified source audit

The original repository contains only `README.md` and `index.html`. V2 imported the following records from `index.html` at commit `c0f8e4cebccf97bf84f6cc73308d8fceda70471d` (lines 527–605). “Enabled” means traceable to that authoritative source record; it does not claim independently explorer-verified bytecode.

| Network | ID | Lottery | USDT | Status |
|---|---:|---|---|---|
| Polygon | 137 | `0x171cc5E40fDeF437DF062D36d082E92eE41b132C` | `0xc2132D05D31c914a87C6611C10748AEb04B58e8F` | Enabled |
| BNB Chain | 56 | `0xC190A715ab6D4B63fF59501460e9f27D16FfAC33` | `0x55d398326f99059fF775485246999027B3197955` | Enabled |
| Arbitrum One | 42161 | `0x162F0B0E205719a25542142b65967D5e686068ee` | `0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9` | Enabled |
| Base | 8453 | `0x0fBF3A5fFE730D95611f08B6Bb315c6161c36eeB` | `0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2` | Enabled |
| Optimism | 10 | `0x73B543CC94a03cb7e9DE38eb4EcAAA883b4804b0` | `0x94b008aA00579c1307B0EF2c499aD98a8ce58e58` | Enabled |
| Avalanche | 43114 | `0x0fBF3A5fFE730D95611f08B6Bb315c6161c36eeB` | `0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7` | Enabled after on-chain verification |

Avalanche and Base reuse the same configured address but were independently verified on-chain; their runtime bytecode hashes differ while the tested lottery read behavior is compatible. See [`docs/onchain-verification.md`](docs/onchain-verification.md). The original ABI specifies `comprarBilhete(uint8[])`, dynamic `precoBilhete`, jackpot/pool/prize reads, and `SorteioRealizado(requestId, maskSorteada)` / `BilheteComprado(jogador, quantidadeApostas)`, plus ERC-20 approval/allowance/balance functions. It mentions Chainlink VRF but includes no coordinator, subscription, key-hash, or callback configuration; V2 does not invent those values.

The read-only dashboard’s exact supported data, bounded-history limits, and intentionally unavailable metrics are documented in [`docs/live-data-capabilities.md`](docs/live-data-capabilities.md).

The independently evidenced deployment blocks, bounded `SorteioRealizado` scan design, mask semantics, and per-network Chainlink VRF audit are documented in [`docs/draw-history-vrf-audit.md`](docs/draw-history-vrf-audit.md).

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
- Ticket value comes from `ticketPrice()` and gas comes from signer estimation for the exact populated transaction.
- Users review network, contract, payment, and estimated gas before their wallet is invoked.
- Event records must be associated through indexed `roundId` and VRF `requestId`; array position is not a source of truth.
- Final wallet confirmation is authoritative. The UI never simulates success.
