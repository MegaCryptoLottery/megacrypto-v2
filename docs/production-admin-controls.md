# Post-admin-controls production candidate controls

**Candidate identity:** `MegaCryptoLotteryV2ProductionCandidate`, source
constant `CANDIDATE_VERSION = "POST_ADMIN_CONTROLS_V1"`.

This is a candidate-control inventory, not deployment approval. It describes
the current source in
[`contracts-v2/contracts-production/MegaCryptoLotteryV2ProductionCandidate.sol`](../contracts-v2/contracts-production/MegaCryptoLotteryV2ProductionCandidate.sol).
All values below are contract units of the immutable configured USDT token.

## Core control model

The candidate separates a **future template** from an opened round. The owner
may propose a `FutureRoundConfig`, but only after `CONFIG_DELAY` (two days) may
the owner activate it. `_open()` copies the then-active values to a new
`Round`; an open, requested, settling, completed, or historical round is never
rewritten by a later activation.

`FutureRoundConfig` is:

```text
ticketPrice, roundDuration,
jackpotBps, weeklyBps, maintenanceBps, oracleBps,
maintenanceWallet, oracleWallet
```

Validation requires a nonzero ticket price, a duration of at least one day,
both operational wallets to be nonzero, and an exact BPS sum of 10,000. The
initial/default economics used by the candidate test fixture are 50/38/6/6:
5,000 jackpot BPS, 3,800 weekly BPS, 600 maintenance BPS, and 600 oracle BPS.

## Administrative and emergency functions

| Group | Function | Authorized caller | Delay / state precondition | Effect | Existing-round effect | Funds / safety boundary | Current event record |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Economics | `proposeFutureRoundConfig(FutureRoundConfig)` | owner | creates `proposedRoundConfigAt = now + CONFIG_DELAY` | stages price, duration, BPS, and wallets | none | no token movement; validates price, duration, wallets, BPS total | `FutureRoundConfigProposed` includes all staged values and execution time |
| Economics | `activateFutureRoundConfig()` | owner | proposal exists and delay elapsed | makes staged economics the active template; updates public active-wallet labels | none; values first apply only when a later round opens | no token movement | `FutureRoundConfigActivated` includes all old/new values; wallet-change events are also emitted |
| VRF | `proposeFutureVrfConfig(VrfConfig)` | owner | creates `proposedConfigAt = now + CONFIG_DELAY`; coordinator must equal immutable `s_vrfCoordinator` | stages subscription, key hash, callback limit, confirmations, words, payment mode | none | cannot replace the callback coordinator | `VrfConfigProposed(version, hash, at)` |
| VRF | `activateFutureVrfConfig()` | owner | proposal exists and delay elapsed | increments `configVersion` and stores a new future VRF config | none; a new round snapshots the version | no token movement; immutable coordinator guard remains | `VrfConfigActivated(version, hash)` |
| Emergency authority | `setEmergencyAuthority(address)` | owner | nonzero address | replaces the emergency actor | none | no fund movement | `EmergencyAuthorityChanged(oldAuthority, newAuthority)` |
| Pause | `setEmergencyPause(bool,bytes32)` | owner or emergency authority | none | pauses sales and lifecycle writes guarded by `whenNotPaused` | claims are deliberately not gated by pause | no token movement | `EmergencyPaused(paused, reason, actor)` |
| Manual contingency | `executeManualContingency(id, entropy, reason, evidence)` | owner or emergency authority | current requested round; pending VRF; no draw method; `VRF_TIMEOUT` elapsed | records a labelled manual draw and moves to settlement-ready | only that pending round; cannot replace completed draw | no arbitrary transfer; later callback faces round-state guards | `ManualContingencyExecuted`, `DrawMethodRecorded` |
| Ownership | inherited `transferOwnership(address)` / `acceptOwnership()` | current owner / pending owner | two-step Chainlink ConfirmedOwner lifecycle | transfers administration | none | no token movement | inherited ownership events |
| Migration | `proposeMigration(address)` | owner | successor must have code and pass token/chain handshake | stages successor | none | no token movement | `MigrationProposed` |
| Migration | `cancelMigration()` | owner | migration must be proposed | cancels staged successor | none | no token movement | `MigrationCancelled` |
| Migration | `executeMigration()` | owner | seven-day `MIGRATION_DELAY`; current round completed | transfers calculated migration amount, then leaves old contract claims-only | no rewrite of historical claims | no arbitrary destination/amount; liability balance remains | `MigrationExecuted(successor, amount, liabilities)` |

## Non-owner lifecycle and claimant functions

These intentionally use the same state machine whether called by Automation or
another caller; they are not owner-only normal-draw shortcuts.

| Function | Guard | Purpose |
| --- | --- | --- |
| `closeRound(id)` / `performUpkeep(CLOSE)` | active open round; cutoff elapsed | freezes ticket range and closes sales |
| `requestRandomness(id)` / `performUpkeep(REQUEST)` | closed, nonempty current round; no request/pending request | creates one VRF request and maps it to the round |
| `processSettlement(id, n)` / `performUpkeep(SETTLE)` | received/manual result; bounded batch | counts each ticket once and finalizes awards |
| `openNextRound()` / `performUpkeep(OPEN_NEXT)` | completed current round; normal migration state | copies active future economics/VRF config to next round |
| `claim(id, offset)` | completed winner ticket owned by caller | pays recorded entitlement; pause/future config cannot rewrite it |

## Economic and accounting behavior

`buyTicket` uses the round snapshot, not a mutable global price or wallet:

1. It pulls exactly `ticketPrice` with `SafeERC20` and rejects an unexpected
   inbound balance delta.
2. It calculates jackpot, weekly, maintenance, and oracle shares using that
   round's BPS. The remainder is retained rounding dust.
3. It transfers maintenance and oracle shares immediately to their snapshotted
   wallets using `SafeERC20`.
4. It checks the post-transfer lottery balance, then records jackpot/weekly
   contributions and dust.

EVM atomicity means a rejected/failed operational-fee transfer reverts the
ticket purchase, all transfers, ticket creation, and reserve updates. There is
no general-purpose owner withdrawal.

`protectedReserves()` reports jackpot reserve, retained dust, and current-round
weekly pool. `solvency()` compares those reserves plus `playerLiabilities` to
the token balance. `migratableBalance()` is constrained by actual balance minus
`playerLiabilities`; execution additionally needs a completed active round.

## Read surfaces and immutable/snapshotted evidence

| Surface | What it proves |
| --- | --- |
| `usdt`, `usdtDecimals` | immutable asset and decimal basis |
| `activeRoundConfig` / `proposedFutureRoundConfig` | current future template and the readable staged template/execution time |
| `maintenanceWallet`, `oracleWallet` | active future-template labels; not a rewrite of prior rounds |
| `rounds(roundId)` | exact price, duration/cutoff, BPS, fee recipients, ticket range, request/draw/settlement data, pools, award, and VRF config version |
| `RoundEconomicsSnapshotted` | economics copied at round opening |
| `TicketPurchased` | paid price, all shares, and dust for reconciliation |
| `vrfConfig(version)` / `drawEvidence(roundId)` | versioned configuration and draw/coordinator evidence |
| `requestIdToRoundId` | direct request-to-round correlation |
| `ticketEntitlement` | claimant, score, winner status, amount, and claimed state |

### Event reconstruction

Economics proposal and activation events include their full configuration
values; activation includes the complete old/new pair. `proposedFutureRoundConfig`
also exposes the staged value and execution time as a read surface. This avoids
requiring off-chain inference from a hash or transaction calldata.

## Explicitly absent controls

- No arbitrary USDT withdrawal, `retirarFundosEmergencia`, or
  `retirarSobrancas` equivalent.
- No post-deployment token or USDT-decimal replacement.
- No in-place VRF coordinator replacement. A coordinator change requires a
  controlled successor/migration lifecycle.
- No owner-only normal draw that bypasses close/request/pending constraints.
- No direct mutable setter for ticket price, BPS, wallets, duration,
  subscription, key hash, callback limit, or payment mode.

## Review boundary

The candidate is not deployable until targeted economics, migration,
legacy-equivalence, adversarial, static-analysis, gas, artifact-hash, and
independent-review gates are complete and recorded. This document does not
authorize a deployment, public-chain transaction, wallet signature, ownership
action, or fund movement.
