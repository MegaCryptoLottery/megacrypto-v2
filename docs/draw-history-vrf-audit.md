# Draw-history and VRF audit

Audit date: 2026-09-15. All blockchain calls used for this audit were read-only.

## Deployment evidence

| Network | Deployment block | Creation transaction / evidence | Result |
| --- | ---: | --- | --- |
| Polygon | 93,187,959 | [Blockscout creation transaction](https://polygon.blockscout.com/tx/0x8b0f37c9b790b40d68e4d42d05935f2e502b7c63e5e6a4abe6a574d0cc8117ac) | Configured |
| BNB Smart Chain | — | BscScan page was Cloudflare-gated and Etherscan V2 creation API requires a paid plan in this environment. No reproducible public creation record was obtained. | Not configured |
| Arbitrum One | 503,193,432 | [Blockscout creation transaction](https://arbitrum.blockscout.com/tx/0xcac83f2338e7efcefa56248b6886d74e795a84b18a9c7cbce8cea27a7399d2f8) | Configured |
| Base | 51,106,590 | [Blockscout creation transaction](https://base.blockscout.com/tx/0x8a2ebe5492784db32fd2120fb08e11c9916fcf618f96e12b93189e41b4ca6626) | Configured |
| Optimism | 156,703,895 | [Blockscout creation transaction](https://optimism.blockscout.com/tx/0x940c567e4e9f90a12e41bb2c233977b76a7fc65c75b567c386f95e807c3df660) | Configured |
| Avalanche | 94,904,282 | [RouteScan transaction record](https://api.routescan.io/v2/network/mainnet/evm/43114/etherscan/api?module=proxy&action=eth_getTransactionByHash&txhash=0x5e7c4e6dc80bab950e5a7404505b46558ff1af5f9cb3636e315ad4f7d4efb4eb) | Configured |

## Draw evidence found during the initial audited range

| Network | `SorteioRealizado` events | Latest block | Request ID | Mask | Transaction |
| --- | ---: | ---: | ---: | ---: | --- |
| Polygon | 2 | 93,236,358 | 0 | 14,296,958 | `0xd0a14d…e5ca8` |
| BNB Smart Chain | Not scanned | — | — | — | deployment start pending |
| Arbitrum One | 1 | 503,203,862 | 0 | 56,465,052 | `0x3b32e2…55cb6` |
| Base | 1 | 51,107,007 | 0 | 32,956,792 | `0x15bfa…82e05` |
| Optimism | 1 | 156,704,208 | 0 | 29,174,712 | `0x87a462…bd9a9` |
| Avalanche | 1 | 94,904,818 | 0 | 54,439,140 | `0x6baf5…8e468` |

The verified source uses `maskSorteada |= 1 << num`; therefore bits 1–25 represent lottery numbers 1–25. The decoder and a real Polygon mask are unit-tested.

## VRF capability matrix

| Network | Status | Coordinator | Request evidence | Draw evidence | Notes |
| --- | --- | --- | --- | --- | --- |
| Polygon | Integration verified | `0x5c210ef41cd1a72de73bf76ec39637bb0d3d7bee` | Verified source calls `s_vrfCoordinator.requestRandomWords` and emits `SorteioSolicitado(requestId)` | 2 events, both request ID 0 | Request ID 0 is the verified manual-contingency path, so these draws are not marked as VRF fulfillments. |
| BNB Smart Chain | Verification pending | — | No reproducible verified-source/creation evidence obtained | Not scanned | No claim is made. |
| Arbitrum One | Integration verified | `0x3c0ca683b403e37668ae3dc4fb62f4b29b6f7a3e` | Same verified source behavior | request ID 0 | Manual-contingency draw. |
| Base | Integration verified | `0xd5d517abe5cf79b7e95ec98db0f0277788aff634` | Same verified source behavior | request ID 0 | Manual-contingency draw. |
| Optimism | Integration verified | `0x05fe58960f730153eb5a84a47c51bd4e58302e1c8` | Same verified source behavior | request ID 0 | Manual-contingency draw. |
| Avalanche | Integration verified | `0xe40895d055bccd2053dd0638c9695e326152b1a4` | Verified SnowTrace source calls VRF v2.5 consumer path | request ID 0 | Manual-contingency draw. |

## Scanner strategy and limits

The UI requires a verified `deploymentStartBlock`; BNB has none and is intentionally skipped. Each call reads a maximum 50,000 blocks from that explicit start/cursor, split into 25 sequential `eth_getLogs` calls of 2,000 blocks. The existing `RpcManager` retries and advances to configured fallback RPCs for every read. There is no `block 0 → latest` query. A returned `nextBlock` permits subsequent bounded pages without inferring a draw from array position.

Some free RPCs prune historical logs or apply range caps. The UI reports that condition as RPC unavailable/retry; it does not substitute invented history. Next-draw timing remains unavailable because the deployed ABI exposes no schedule getter.
