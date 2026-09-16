# Hardened V2 adversarial security review

Audit date: 2026-09-16. Scope: the **local-only reference** in `contracts-v2/contracts/MegaCryptoLotteryHardenedV2.sol`. This is not a production audit or deployment approval.

## Executive result

Three confirmed design defects were fixed during this review:

| Severity before fix | Defect | Fix and regression coverage |
|---|---|---|
| High | A fee-on-transfer ticket token could credit reserves by the nominal price while the contract received less, making liabilities/reserves insolvent. | Purchase compares pre/post token balance and rejects non-exact receipt with `UNSUPPORTED_TOKEN_BEHAVIOR`. |
| Medium | `processSettlement` accepted attacker-selected unbounded `maxTickets`; a caller could build avoidably unexecutable batches and confuse operational automation. | `MAX_SETTLEMENT_BATCH = 200`; invalid batch regression test added. |
| Medium | Manual contingency also emitted the generic VRF fulfillment event, making result logs easier to mislabel. | Manual path emits only `ManualContingencyExecuted`; VRF callback exclusively emits `RandomnessFulfilled`. |

No unresolved Critical finding was identified in this source review. **High unresolved finding: callback authentication and migration safety have only local-mock coverage and require independent audit before testnet. STATUS: BLOCKS TESTNET.** The implementation must not be called production-ready.

## Accounting equation

For each successful exact-price ticket payment `P`:

```text
P = floor(50% P) jackpot + floor(38% P) weekly + floor(6% P) maintenance
  + floor(6% P) oracle + per-ticket division remainder
```

The configured percentages sum to 10,000 basis points. Each per-ticket basis-point truncation remainder is recorded in `unallocatedDustReserve` and is included in protected reserves/solvency. Final award split dust is handled separately: `totalAward` is reduced to a multiple of finalists and the remainder goes to `jackpotReserve`.

At any state transition, the local invariant is:

```text
playerLiabilities + jackpotReserve + currentRound.weeklyPool
  + maintenanceReserve + oracleReserve <= actualTokenBalance
```

The tests exercise lifecycle solvency after randomized round settlement. They do **not** yet prove conservation across many historical completed rounds, all price remainders, or migration from a real USDT implementation. That additional work blocks testnet.

## Migration attacks

| Attack | Result in source | Status |
|---|---|---|
| EOA / zero successor | rejected by address/code checks | tested locally for invalid contract path |
| Invalid magic / wrong token / wrong chain | handshake rejects | source reviewed; needs dedicated tests |
| Migration with active OPEN/CLOSED/VRF/settlement round | rejected unless current round is `COMPLETED` | OPEN tested locally; remaining states require expanded suite |
| Outstanding earned claims | `migratableBalance = balance - playerLiabilities`; claims remain enabled | source reviewed; needs migration-with-liabilities integration test |
| Reentrant successor | outer migration is non-reentrant and migration state changes before external calls | source reviewed; malicious receiver test required |
| Pause / pending config / pending ownership | pause does not block claims; pending config cannot alter closed snapshot; pending ownership does not bypass owner | source reviewed |

## Claims and token behavior

Claims are per `(roundId, ticketOffset)`, require ticket ownership and best score, and mark claimed before transfer under reentrancy protection. Multiple tickets from one wallet are independently claimable. Wrong wallet, repeated, cross-round offset, non-winner, and zero-award claims revert.

Supported payment token behavior is intentionally narrow: standard ERC-20 transfer/transferFrom that either returns true or no data and transfers the exact nominal amount. Fee-on-transfer tokens are rejected on ticket purchase. False-return tokens revert through the SafeERC20 wrapper. Reentrant/malicious-token integration tests remain required before testnet.

## VRF and Automation review

- Callback accepts only the coordinator snapshotted on that round and maps solely via `requestIdToRoundId`.
- Unknown, duplicate, delayed-after-manual, old-round, and wrong-coordinator callbacks revert by state/request checks.
- Request state is written before the external coordinator call; if that call reverts, EVM atomicity rolls back state.
- Future VRF configuration versions do not modify older round snapshots; an older coordinator remains authoritative for its outstanding callback.
- `performUpkeep` revalidates round ID/action/state. Stale IDs, incorrect actions, pre-VRF settlement, repeated actions, zero batches, and `maxTickets > 200` revert.

The mock coordinator is not adversarial enough to prove coordinator reentrancy/collision behavior. Production must use the official VRF v2.5 consumer base and official coordinator interface verified for the exact Chainlink release. **STATUS: BLOCKS TESTNET.**

## Privilege table

| Function family | Owner | Emergency | Public / Automation | Timelock | Current round impact | Fund movement |
|---|---:|---:|---:|---:|---:|---:|
| Buy / close / request / settle / open | no special privilege | no special privilege | yes, state-gated | no | yes | ticket payment only |
| VRF callback | no | no | coordinator only | no | yes | no |
| Emergency pause / contingency | owner | yes | no | timeout for contingency | yes | no |
| Future VRF config proposal/activation | yes | no | no | 2 days | future rounds only | no |
| Ownership / emergency authority | yes | no | no | two-step ownership | future administration | no |
| Migration proposal/cancel/execute | yes | no | no | 7 days | only after completed round | migratable amount only |
| Claim | no | no | ticket owner | no | prior/current completed rounds | player entitlement |

The owner cannot directly transfer arbitrary USDT. Governance can migrate non-liability balance after timelock; this remains a material governance risk and requires multisig/timelock and external audit.

## Event/proof review

Events prove round opening/cutoff, ticket receipt/mask, closure, request binding, VRF fulfillment, manual contingency, settlement amount/dust, individual claims, configuration proposal/activation, and migration proposal/execution. A frontend can identify manual draws from the manual-only event. It cannot prove off-chain keeper intent, manual entropy fairness, Chainlink subscription funding, or an incident reason's truth.

Missing for production observability: an explicit per-round `DrawMethod` state/getter and a `PrizeEntitlementDefined` summary event. They are **Low** improvements; no unbounded winner event loop should be added.

## Scalability

The VRF callback stores the mask and changes state only; it does not iterate tickets. Local EVM estimates for `processSettlement(roundId, 1)` were 130,155 gas for a one-ticket final batch and 70,174 gas for non-final rounds of 10 and 100 tickets. The safe local cap is 200 tickets per transaction. This is a starting limit, **not a production gas limit**.

Analytical result for 1,000 / 10,000 / 100,000 tickets: callback cost remains O(1); settlement requires respectively at least 5 / 50 / 500 calls at batch 200, with each call bounded by batch rather than total round size. Dedicated harness benchmarks with realistic storage and target-chain gas schedules are REQUIRED_BEFORE_DEPLOYMENT.

## Security gate

| Severity | Unresolved issue | Status |
|---|---|---|
| Critical | None identified in local review | — |
| High | No independent audit; no real coordinator/USDT/malicious successor integration suite | **BLOCKS TESTNET** |
| Medium | Full multi-round conservation/migration and malicious-token integration tests incomplete | **BLOCKS TESTNET** |
| Low | Add explicit draw-method getter/summary entitlement event; gas benchmarks on target chains | Required before production |
| Informational | Block timestamp has normal chain tolerance; manual contingency remains trust-based | Documented risk |

No deployment, transaction, signature, wallet connection, production VRF request, Automation registration, ownership change, or fund movement occurred in this audit.

