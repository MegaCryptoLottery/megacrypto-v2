# Hardened MegaCrypto Lottery V2 contract specification

**Status:** design specification only, 2026-09-16. This document proposes a future contract family; it does not change the currently deployed contracts, authorize a migration, or move funds.

## Purpose and fixed business model

The future system preserves the existing game rules:

- a ticket contains exactly 15 unique integers from 1 through 25;
- tickets are paid in the configured USDT token;
- each round allocates 50% to the jackpot, 38% to that round's weekly prize pool, 6% to maintenance, and 6% to draw/oracle operations;
- Chainlink VRF v2.5 is the ordinary random source; manual contingency is exceptional, explicitly labelled, and never represented as VRF;
- prizes are credited and claimed by players; and
- all material lifecycle, ticket, randomness, settlement, allocation, and claim facts are reconstructible from events and immutable round state.

The contract code should be one audited codebase with immutable constructor/configuration parameters per network. Every deployment must be independently compiled, verified on its explorer, and audited before it is used.

## Data model and immutable round snapshot

```text
enum RoundState { OPEN, CLOSED, VRF_REQUESTED, COMPLETED, EMERGENCY }

Round {
  id
  state
  openedAt, cutoffAt, closedAt, settledAt
  ticketPrice, usdt
  jackpotBps, weeklyPoolBps, maintenanceBps, oracleBps
  jackpotContribution, weeklyPool, maintenanceAccrued, oracleAccrued
  vrfCoordinator, subscriptionId, keyHash, callbackGasLimit,
  requestConfirmations, numWords, payWithNative
  ticketCount, settlementCursor, bestScore, finalistCount
  winningMask, vrfRequestId, manualReasonHash
}
```

`roundId` is monotonically increasing. Opening the following round does not mutate an earlier round. At creation, the contract snapshots the ticket price, token, percentage configuration, cutoff timestamp, and VRF configuration relevant to that round. Later configuration changes can take effect only for a newly opened round.

A ticket records its `roundId`, purchaser, packed 25-bit number mask, ticket index, and price paid. The contract rejects a purchase unless the current round is `OPEN` and `block.timestamp < cutoffAt`. A purchase in the cutoff block follows this deterministic rule: it is valid only while the timestamp is strictly earlier than `cutoffAt`. It is therefore impossible for a ticket purchased after closure to join the closed round.

The ticket collection for a round is append-only while `OPEN`. `closeRound` irrevocably sets `CLOSED`, records the final ticket count, and thereby freezes the ticket set. Randomness can only be requested for the frozen `roundId`; settlement must only iterate that round's bounded ticket range, never a live/global ticket array.

## Lifecycle and normal Automation/VRF flow

1. `OPEN`: ticket purchases are accepted before `cutoffAt`.
2. `CLOSED`: Automation or an authorized public executor closes an eligible round, snapshots its final ticket range/configuration, and prevents further ticket entry.
3. `VRF_REQUESTED`: exactly one successful VRF request is associated with the closed round.
4. `COMPLETED`: the VRF value was finalized, winner processing/allocation is complete, and a successor round may be opened.
5. `EMERGENCY`: only the defined timeout route was used; its outcome is permanently identified as contingency rather than VRF.

`checkUpkeep(bytes)` is view-only. It returns true only for deterministic, on-chain conditions such as: a current round is open and past its cutoff; or a closed round has no request; or an eligible pending request is ready for the next bounded settlement stage. `performUpkeep(bytes)` repeats all state checks, decodes an expected `roundId`/action, and reverts if it is stale. This makes duplicate Automation executions harmless.

The normal request operation must be callable by a permissionless Automation-compatible path after the on-chain cutoff, or by a narrowly scoped `AUTOMATION_ROLE`; it must not require the owner private key on every weekly draw. The role may be granted to a Chainlink Automation forwarder/registry as appropriate for the deployment, but the function itself still validates the round state and cutoff. The owner must not be able to substitute or influence the random word.

Before requesting, the contract requires `state == CLOSED`, `ticketCount > 0`, and `vrfRequestId == 0`. It sets the round state and an explicit `requestPending` flag before calling the coordinator. On return it stores both `round.vrfRequestId` and `requestIdToRoundId[requestId]`. No second request is valid while the round is pending. The mapping must not be overwritten.

`fulfillRandomWords(requestId, words)` obtains `roundId` solely from `requestIdToRoundId`; it rejects unknown requests, already-completed rounds, and non-pending state. It derives the mask using the documented 1–25 mask semantics, stores the result on that exact round, and starts/continues settlement only for that round. A delayed or out-of-order callback cannot settle a different or later round, and later-round tickets cannot be processed by an older request.

## Settlement and gas scalability

The current O(number of tickets) winner calculation in one VRF callback is not suitable for an unbounded lottery. Callback gas can be exhausted as ticket count grows, potentially leaving a requested round unable to complete. Increasing `callbackGasLimit` is not a scalable remedy and varies by chain/coordinator limits.

The recommended architecture is a **multi-step, bounded settlement**:

1. The VRF callback performs only constant-cost work: validates the mapped request, records `winningMask`, moves the round into a settlement-pending state represented internally by `VRF_REQUESTED` plus a cursor, emits `RandomnessFulfilled`, and returns.
2. Anyone, including Automation, calls `processSettlement(roundId, maxTickets)` for a configured bounded number of frozen tickets. The contract advances `settlementCursor`, computes each ticket score, and records the current best score and winner count using fixed-cost per-ticket operations.
3. After the cursor reaches the snapshotted `ticketCount`, a bounded `finalizeSettlement(roundId)` determines the award. If no ticket scores 15, the 50% jackpot contribution rolls into the next jackpot; the weekly pool is assigned according to the defined weekly-prize rule. Otherwise, the weekly pool and any qualifying jackpot component are split among the final best-scoring tickets exactly as specified by the business rules.
4. Allocation remains claim-based. To avoid a second unbounded credit loop, store final round parameters and let `claim(roundId, ticketIndex)` prove one ticket's entitlement once, using a claimed bitmap/mapping. If an equal-split remainder exists, define a deterministic dust rule (for example, leave it in the next jackpot) in the audited implementation.

This approach makes the VRF callback safe at large scale and makes settlement progress resumable after a gas, Automation, or RPC failure. It does mean final allocation can take several transactions; frontend status must distinguish `VRF received` from `Round settled`.

An alternative Merkle-root claim design can reduce on-chain per-ticket scanning, but introduces a trusted/off-chain result publisher unless backed by a challenge/proof scheme. It is not recommended as the primary fairness model for this lottery. The bounded on-chain scan is slower but independently verifiable.

## Emergency contingency and pause

`emergencyPause()` is an immediate, least-privilege pause for purchases, normal requests, settlement actions, and claims only as explicitly necessary for incident safety. It emits the actor and a reason hash. Unpause should be timelocked/multisig-controlled where operationally practical.

Manual contingency is a last resort and should be unavailable while normal VRF is progressing. It may be entered only when all of these are on-chain true:

- the round is `VRF_REQUESTED` with a nonzero request ID;
- `block.timestamp` exceeds a clearly configured VRF timeout from request time;
- no fulfillment has been recorded; and
- a dedicated emergency authority executes the function, ideally through a multisig/timelock.

It must emit `ManualContingencyExecuted(roundId, originalRequestId, reasonHash, evidenceURIHash, actor, entropyCommitment)` and set `EMERGENCY`. It must never use `requestId == 0` as a substitute for a VRF request. The result data includes `drawMethod = MANUAL_CONTINGENCY`; frontend code must label it unambiguously and show the transaction/evidence. The precise emergency randomness mechanism requires a separate governance decision: a simple owner-supplied seed is not cryptographically comparable to VRF and should be treated as trust-based. A commit/reveal or publicly auditable incident procedure can reduce, but not eliminate, emergency trust.

## Ownership, roles, and configuration

Use two-step ownership and make the owner a multisig-compatible address. Separate capabilities:

| Capability | Recommended authority |
|---|---|
| Upgrade/configuration (if any) | timelocked multisig owner |
| Pause / emergency escalation | narrowly scoped emergency multisig |
| Normal close/request/settlement progress | permissionless valid call or `AUTOMATION_ROLE` |
| VRF callback | configured coordinator only |
| Manual contingency | emergency multisig after timeout |

No administrative configuration change may modify a closed round's price, percentages, token, cutoff, ticket range, coordinator, subscription, key hash, confirmations, word count, native-payment setting, or callback gas. Configuration setters apply to a future-round template only, emit old/new values, and should be timelocked where feasible. There must be no frontend private key, owner key, keeper key, or Automation secret.

## Required events and frontend-proof boundary

The implementation must emit indexed, sufficient events:

```text
RoundOpened(roundId, cutoffAt, ticketPrice, token, configHash)
TicketPurchased(roundId, ticketIndex, player, numberMask, paid)
RoundClosed(roundId, ticketCount, cutoffAt)
RandomnessRequested(roundId, requestId, coordinator, requestConfigHash)
RandomnessFulfilled(roundId, requestId, winningMask)
RoundSettled(roundId, winningMask, bestScore, finalistCount, jackpotRollover)
PrizeAllocated(roundId, ticketIndex, player, amount, prizeKind)
PrizeClaimed(roundId, ticketIndex, player, amount)
ManualContingencyExecuted(roundId, originalRequestId, reasonHash, evidenceURIHash, actor, entropyCommitment)
EmergencyPaused(paused, reasonHash, actor)
```

From on-chain evidence, the frontend can prove: the configured/snapshotted round terms, a ticket's recorded round/mask/payment, exact cutoff/closure order, request-to-round binding, request method, recorded winning mask and decoded numbers, settlement/allocation/claim transactions, and whether a result was VRF or manual contingency. It cannot prove real-world claims such as a keeper's intent, the availability of off-chain infrastructure, or the fairness of a manually supplied contingency seed.

Event readers must continue to use deployment-start blocks, bounded block ranges, pagination, retry/fallback RPCs, and IDs rather than array indexes. The explorer link, block timestamp, transaction hash, and chain ID should be presented alongside any result.

## Threat model and controls

| Threat | Contract-level control | Operational residual risk |
|---|---|---|
| Malicious owner | multisig/timelock; immutable closed-round config; no owner-controlled VRF word | governance compromise |
| Compromised Automation executor | state/cutoff/idempotency checks; least-privilege role | liveness disruption only if permissionless progress unavailable |
| Duplicate upkeep | round state, requestPending, request map, stale-action reverts | transaction fees for reverted duplicates |
| Delayed/out-of-order VRF | requestId-to-round mapping; callback state validation | delayed completion, then timeout policy |
| Cutoff boundary purchase | strict timestamp comparison and closed round ticket snapshot | normal block timestamp tolerance |
| RPC/Automation outage | permissionless resumable bounded actions; multiple keepers/monitoring | temporary liveness loss |
| VRF subscription underfunding | on-chain revert plus off-chain subscription alerts | owner/operator funding action still needed |
| Callback gas exhaustion | constant-cost callback; cursor settlement | settlement liveness needs callers |
| Very large ticket volume | frozen indexed range; bounded chunks; claim-by-ticket | storage/gas economics and UX latency |
| Manual contingency abuse | VRF timeout, nonzero request requirement, emergency role, evidence event | emergency procedure remains trust-based |

## Migration strategy (not implemented)

Migration requires a separately approved, audited plan; no funds or state should move merely because this document exists. Before any migration, inventory each chain's current jackpot/pool balances, ticket records, draw state, claimable prizes, token balances, ownership, and outstanding/nonzero VRF requests from read-only evidence.

The safest default is **parallel operation**: freeze only through a lawful/on-chain existing mechanism after all open rounds are finalized, preserve old contracts and their claim routes, and launch a new system with fresh accounting. If a transfer mechanism is considered, it must be explicit, audited, multisig-governed, per-chain, evented, and accompanied by a claims/snapshot strategy that cannot strand existing tickets or prizes. Never assume balances, ticket arrays, or claims can be transplanted without a purpose-built migration contract.

## Six-chain deployment strategy

One common audited codebase can be deployed independently to Polygon, BNB Chain, Arbitrum One, Base, Optimism, and Avalanche. Each deployment must have an explicit immutable/config-snapshotted record for its USDT address and decimals, VRF v2.5 coordinator, subscription ID, gas lane/key hash, callback gas limit, confirmations, word count, native-payment option, native-gas economics, explorer, and Automation registry/forwarder policy. No address, decimal, coordinator, or subscription can be copied across chains by assumption.

Use the same event schema and round semantics on every chain so the frontend can remain common, while treating each deployment, VRF subscription, Automation configuration, funding balance, and verification result independently.

## Recommendation

Choose **B — eventual migration to hardened contracts with native Automation/VRF lifecycle**. The current contracts have source-evidenced absence of an on-chain cutoff, round snapshot, request-pending lock, request-to-round binding, and bounded settlement. An external owner keeper (option A) can improve liveness but cannot enforce those missing on-chain safety properties or eliminate the callback gas-growth risk. Option A should be treated only as a temporary, tightly controlled operational procedure after complete per-network evidence—not as safe autonomous weekly draw infrastructure.

Remaining risks after a hardened deployment include multisig compromise, Chainlink/Automation liveness, subscription funding, chain congestion, ticket-volume economics, and the inherently trust-based nature of any emergency contingency. They require monitoring, incident procedures, independent audits, and per-chain verification.

