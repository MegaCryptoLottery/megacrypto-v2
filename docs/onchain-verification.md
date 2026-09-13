# On-chain verification — 2026-09-13

All checks were read-only JSON-RPC calls at `latest`: `eth_chainId`, `eth_getCode`, `web3_sha3` of the exact runtime bytecode, and harmless ABI reads. No account was connected and no transaction was sent.

| Network | Lottery | Runtime hash | USDT | Ticket price | USDT decimals |
|---|---|---|---|---:|---:|
| Polygon (137) | `0x171cc5E40fDeF437DF062D36d082E92eE41b132C` | `0x2b842286e3eef939eef2d4f4e6d2c7a68254c6ed7594ab4d2450ff8d703fbe08` | `0xc2132D05D31c914a87C6611C10748AEb04B58e8F` | 5,000,000 | 6 |
| BNB Smart Chain (56) | `0xC190A715ab6D4B63fF59501460e9f27D16FfAC33` | `0x882a7ed4c057a1a6677bbf81653e05b74c300c2ae845c308caf81aba680d173d` | `0x55d398326f99059fF775485246999027B3197955` | 5,000,000,000,000,000,000 | 18 |
| Arbitrum One (42161) | `0x162F0B0E205719a25542142b65967D5e686068ee` | `0xc940d869013a706f7e92676eaacd5ac6a86d2bb8da127067a99a27724dd8555d` | `0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9` | 5,000,000 | 6 |
| Base (8453) | `0x0fBF3A5fFE730D95611f08B6Bb315c6161c36eeB` | `0x2aee76aaab5dfb04ac4689207b14589e0e5dde8279a4956739e372035341d934` | `0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2` | 5,000,000 | 6 |
| Optimism (10) | `0x73B543CC94a03cb7e9DE38eb4EcAAA883b4804b0` | `0x2ac5089a9f18244dc5a048ddbea1b40c9d3850ecb0e014803ff9831ad699a735` | `0x94b008aA00579c1307B0EF2c499aD98a8ce58e58` | 5,000,000 | 6 |
| Avalanche C-Chain (43114) | `0x0fBF3A5fFE730D95611f08B6Bb315c6161c36eeB` | `0xee917cd803e78d10e7818097936fe0ebab2aad4f88a22cb3aab3d8552463c70c` | `0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7` | 5,000,000 | 6 |

Every lottery and token address returned non-empty runtime code. `precoBilhete`, `jackpotAcumulado`, `poolSemanal`, and token `decimals()` decoded successfully on all chains. Base and Avalanche expose the same configured lottery address and matching read behavior, but their runtime bytecode hashes are **not identical**; each chain was independently verified and Avalanche is enabled.

