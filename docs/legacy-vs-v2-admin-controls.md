# Legacy administration versus post-admin-controls V2

## Scope and evidence

This is a source-level administration inventory, not a claim that a recovered
file is byte-for-byte identical to every public deployment. It is based on the
owner-supplied recovered Solidity files recorded in
[`contract-source-comparison.md`](contract-source-comparison.md). That document
retains their full SHA-256 values and the separate deployed-runtime evidence.

| Recovered contract | Network represented by its contract name | Source family |
| --- | --- | --- |
| `MegaCryptoLottery` | Polygon | modern VRF v2.5 |
| `MegaCryptoLotteryArbitrum` | Arbitrum One | modern VRF v2.5 |
| `MegaCryptoLotteryBase` | Base | modern VRF v2.5 |
| `MegaCryptoLotteryOptimism` | Optimism | modern VRF v2.5 |
| `MegaCryptoLotteryAvalanche` | Avalanche | modern VRF v2.5 |
| `MegacryptoArbitrum` | historical Arbitrum | pre-modern/incomplete stub; excluded from modern deployment matching |

The five modern sources have the same owner/configuration surface except that
the Polygon source has no `retirarFundosEmergencia`; the Arbitrum, Base,
Optimism, and Avalanche sources do. No recovered BNB source exists. A
previously reported Polygon runtime `setCoordinator` selector is not in the
recovered modern source, so it is a runtime/source discrepancy—not evidence
that the source-level capability existed across other networks.

## Classification terms

| Classification | Meaning here |
| --- | --- |
| **RESTORE** | Preserve the valid product behavior only in the named V2 form. |
| **REPLACE WITH SAFER V2 VERSION** | Preserve the business need with delayed activation, validation, snapshots, or lifecycle guards. |
| **KEEP CURRENT V2** | V2 already supplies the safer control; do not recreate the legacy API. |
| **DO NOT RESTORE** | The legacy capability enables unsafe fund movement, unfair draw control, or unsupported mutation. |

## Exhaustive owner, administrator, and configuration inventory

| Legacy control / authority | Recovered-source coverage | Legacy effect / guard | Classification | Post-admin-controls V2 disposition |
| --- | --- | --- | --- | --- |
| `setPrecoBilhete(uint256)` | all five modern sources; historical stub | Owner changes price immediately. Modern sources require `> 0`; stub does not. | **REPLACE WITH SAFER V2 VERSION** | `proposeFutureRoundConfig` then `activateFutureRoundConfig` after `CONFIG_DELAY` (2 days). Price is copied into a newly opened round; no open or historical price mutates. |
| `setDivisaoValores(uint256,uint256,uint256,uint256)` | all five modern sources | Owner immediately changes maintenance, apuração/oracle, jackpot, and weekly percentages; only sum-to-100 check. | **REPLACE WITH SAFER V2 VERSION** | Future config uses four BPS fields with exact `BPS == 10_000` invariant; each round snapshots them before sales. |
| `setWalletManutencao(address)` | all five modern sources | Owner immediately redirects maintenance fees; rejects zero address. | **REPLACE WITH SAFER V2 VERSION** | Future config requires nonzero `maintenanceWallet`, delayed activation, and per-round recipient snapshot. |
| `setWalletApuracao(address)` | all five modern sources | Owner immediately redirects apuração/oracle fees; rejects zero address. | **REPLACE WITH SAFER V2 VERSION** | Future config requires nonzero `oracleWallet`, delayed activation, and per-round recipient snapshot. |
| Immediate ticket fee collection/forwarding in `comprarBilhete(uint8[])` | all five modern sources; historical stub has the same broad pattern | Player pays maintenance and apuração directly; jackpot and weekly shares remain in the lottery. | **RESTORE** | `buyTicket(uint32)` receives exact price, then atomically forwards snapshotted maintenance/oracle shares using `SafeERC20`; failed outbound transfer reverts the full purchase. |
| `setNativePayment(bool)` | all five modern sources | Owner immediately changes native versus LINK VRF payment. | **REPLACE WITH SAFER V2 VERSION** | Delayed, versioned `proposeFutureVrfConfig` / `activateFutureVrfConfig`; a round uses its stored version. |
| `setKeyHash(bytes32)` | all five modern sources | Owner immediately changes VRF gas lane/key hash. | **REPLACE WITH SAFER V2 VERSION** | Delayed, versioned future VRF config. |
| `setCallbackGasLimit(uint32)` | all five modern sources | Owner immediately changes callback gas; modern source caps it at 2,500,000. | **REPLACE WITH SAFER V2 VERSION** | Delayed, versioned future VRF config; no direct setter is recreated. |
| `setSubscriptionId(uint256)` | all five modern sources | Owner immediately changes VRF subscription. | **REPLACE WITH SAFER V2 VERSION** | Delayed, versioned future VRF config. |
| Constructor coordinator / reported runtime `setCoordinator` discrepancy | modern constructors bind `VRFConsumerBaseV2Plus(_vrf)`; no recovered modern source has a coordinator setter | A mutable coordinator changes the callback trust boundary. | **DO NOT RESTORE** | Each proposed V2 VRF config must retain `address(s_vrfCoordinator)`. A coordinator migration requires a controlled successor lifecycle. |
| `solicitarSorteio()` | all five modern sources; stub declares it but has no request implementation | `onlyOwner`; requests live VRF when tickets exist, with one `lastRequestId` and no round snapshot or duplicate-pending protection. | **REPLACE WITH SAFER V2 VERSION** | Permissionless bounded request after on-chain close; V2 maps request ID to round, records request pending, and snapshots a VRF config version. |
| `simularSorteioManual(uint256)` | all five modern sources; historical stub | `onlyOwner`; derives a local word from owner seed, time, and `prevrandao`, then processes live tickets. It is not Chainlink VRF. | **REPLACE WITH SAFER V2 VERSION** | `executeManualContingency` requires owner/emergency authority, a pending requested round, and `VRF_TIMEOUT`; it records reason/evidence and cannot replace a completed result. |
| `retirarFundosEmergencia(address)` | Arbitrum, Base, Optimism, Avalanche modern sources; absent from Polygon source | `onlyOwner`; zeros jackpot/weekly variables and transfers both pools to any nonzero destination, without preserving player claims. | **DO NOT RESTORE** | No arbitrary withdrawal. Only time-delayed, receiver-handshaked migration after active-round completion; player liabilities remain claimable in the old contract. |
| `retirarSobrancas(address,uint256)` | historical Arbitrum stub only | `onlyOwner`; transfers arbitrary USDT to arbitrary recipient with no reserve/liability check. | **DO NOT RESTORE** | No V2 equivalent. It could drain prize or claimant funds. |
| Modern inherited ownership (`onlyOwner`, `transferOwnership`, `acceptOwnership`) | five modern sources inherit the Chainlink owner chain; stub has custom constructor owner and no transfer lifecycle | Controls all listed owner functions. | **KEEP CURRENT V2** | Keep Chainlink `ConfirmedOwner` two-step transfer/acceptance; do not restore a custom single-step owner. |
| `setEmergencyAuthority(address)` / `setEmergencyPause(bool,bytes32)` | no legacy equivalent | Legacy sources have neither a distinct emergency actor nor a broad pause. | **KEEP CURRENT V2** | V2 keeps a distinct emergency authority, explicit pause reason/event, and no reserve seizure. Claims remain callable. |
| `proposeMigration`, `cancelMigration`, `executeMigration` | no legacy equivalent | Legacy rescue had no delay, receiver handshake, active-round gate, or liability preservation. | **KEEP CURRENT V2** | V2 uses a delayed successor handshake and claims-only terminal state instead of a rescue withdrawal. |
| Round duration / schedule setter | no legacy setter or enforced schedule | Recovered sources expose no draw interval, cutoff, close, or ticket snapshot. | **REPLACE WITH SAFER V2 VERSION** | `roundDuration` is delayed future config, minimum one day, and becomes an immutable `cutoffAt` snapshot at round opening. |
| USDT/token replacement | no recovered setter | Token is constructor-configured. | **KEEP CURRENT V2** | `usdt` and `usdtDecimals` are immutable; a token change requires a successor, not an in-place mutation. |
| `reclamarPremio()` | all recovered sources | User claim, not an administrator control. | **KEEP CURRENT V2** | Ticket/round claims remain independent from future config, pause, and migration setup. |
| `getApostasCount()` / `getHistoricoCount()` | all recovered sources | Read-only convenience functions, not admin controls. | **KEEP CURRENT V2** | V2 exposes round, ticket, evidence, and entitlement state rather than mutable-array convenience APIs. |

## Cross-network differences

| Topic | Polygon source | Arbitrum/Base/Optimism/Avalanche modern sources | Historical Arbitrum stub |
| --- | --- | --- | --- |
| Emergency withdrawal | absent | `retirarFundosEmergencia` present | `retirarSobrancas` instead |
| VRF request | complete source path | complete source path | placeholder only |
| Manual draw | owner-driven, processes live tickets | owner-driven, processes live tickets | simplified award to first ticket holder |
| Price validation | positive price required | positive price required | no positive-price guard |
| Ownership | inherited modern owner chain | inherited modern owner chain | custom owner; no transfer lifecycle |

## Non-negotiable V2 properties

1. A proposal is never an immediate economic mutation. It takes effect only
   after delay and only in a newly opened round.
2. A round retains its own price, BPS, fee recipients, duration, and VRF config
   version regardless of later template activation.
3. The BPS invariant is exactly 10,000. The candidate defaults are 5,000
   jackpot, 3,800 weekly, 600 maintenance, and 600 oracle (50/38/6/6).
4. Operational maintenance/oracle payments are immediate `SafeERC20` transfers,
   not owner-withdrawable retained reserves; a failed transfer rolls back the
   purchase.
5. There is no general-purpose withdrawal. Controlled successor migration must
   preserve player liabilities.
6. Normal randomness is round-bound. A manual contingency is a labelled,
   post-timeout exception—not Chainlink-verified randomness.

## Audit boundary

This is a candidate source review. It does not certify artifacts or authorize a
deployment, public-chain transaction, wallet signature, ownership action, or
fund movement. Required test, static-analysis, gas, artifact-hash, and
independent-review gates remain separate.
