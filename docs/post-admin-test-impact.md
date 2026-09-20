# Post-admin-controls test impact

This record scopes validation for the post-admin-controls production-candidate
revision.  It is a local Ganache/EVM test record only: it does not authorize or
perform a deployment, transaction, signature, ownership change, VRF request, or
fund movement on a public chain.

## Targeted regression result

Command run after compiling the current candidate artifact:

```text
npx mocha --timeout 120000 test/production-candidate.admin-controls.test.mjs
```

Result: **11 passing** (31 seconds).

The local Ganache provider can incorrectly reject gas estimation for the
successful post-timelock `activateFutureRoundConfig()` storage write.  The test
therefore supplies a local-only `gasLimit: 500000n` for that successful call.
The test first proves the same call reverts before its two-day timelock; the
override does not bypass the candidate's timelock or any contract check.

## Executable coverage

`contracts-v2/test/production-candidate.admin-controls.test.mjs` covers the
changed operational and accounting surface with independent balance snapshots:

| Area | Assertions exercised |
| --- | --- |
| Default future-round economics | Constructor and Round 1 snapshot are exactly 50% jackpot / 38% weekly / 6% maintenance / 6% oracle; BPS total is exactly 10,000. |
| Decimal coverage | The default percentage accounting is verified at both six and eighteen token decimals. |
| Immediate fees | Maintenance and oracle receive their exact fees during a successful purchase; the lottery retains only jackpot, weekly pool, and rounding dust. |
| Future-only scheduling | 60/30/5/5 and 40/40/10/10 profiles (including a one-day future duration) activate only after the timelock, apply only to subsequently opened rounds, retain their own wallet snapshots, and emit explicit proposed/new and activated old/new economics. |
| Invalid administration | Invalid BPS total, zero price, too-short duration, zero recipient, and non-owner proposals revert without mutating active/current economics. |
| Jackpot rollover | A non-jackpot round rolls its jackpot forward; a later exact winner receives its current weekly pool plus the carried and current jackpot exactly once. |
| Rounding | A 5,000,001 six-decimal ticket under 40/40/10/10 leaves exactly one retained, auditable dust unit. |
| Hostile token input | Fee-on-transfer, unexpected-positive-delta, and false-return `transferFrom` tokens all revert atomically. |
| Operational recipient failure | False-return fee transfers and separately rejected maintenance/oracle recipients revert atomically, including ticket index, reserves, recipient balances, and lottery balance. |
| Reentrancy | Reentrant purchase and claim attempts cannot create duplicate tickets, duplicate fee transfers, claims, or player liabilities. |
| Historical claims | A completed Round 1 entitlement remains exact after a later future configuration becomes active. |
| Migration liabilities | Only retained non-liability funds migrate; already-external operational fees do not enter the migratable amount; the old contract retains and pays the historical claim exactly. |
| Pause/emergency | An unauthorized caller cannot pause; the designated emergency authority blocks sales without changing reserves or configuration; normal sales resume after unpause. |
| VRF/economic isolation | A round that already requested authenticated VRF settles with its original economics even after a future economic profile is activated; request-to-round mapping and draw-evidence coordinator remain intact. |

Every successful purchase/settlement scenario independently reconciles:

```text
lottery token balance
  = player liabilities
  + jackpot reserve
  + current-round weekly pool
  + unallocated rounding dust
```

The immediate maintenance/oracle fees are intentionally outside that retained
lottery balance because they have already been transferred to the snapshotted
operational wallets.

## Gate impact

| Gate | Affected | Required validation for this revision | Status in this focused pass |
| --- | --- | --- | --- |
| Official-import compilation | Yes | Compile current candidate and mocks | Completed before targeted suite |
| Production lifecycle | Yes | Targeted lifecycle/configuration regression | Covered by the 11-case suite |
| Ownership / ConfirmedOwner | No behavioral change | Owner-only configuration smoke | Covered for non-owner configuration rejection |
| Multi-round accounting | Yes | Focused cross-round economics, rollover, claims, and dust regression | Covered; the historic 500-round campaign is intentionally not rerun automatically |
| Hostile ERC-20 | Yes | Input and outbound-fee failure/reentrancy paths | Covered |
| VRF | Economic-snapshot impact only | Requested-round config activation then authenticated fulfillment | Covered |
| Migration liabilities | Yes | Retained amount plus historical claim preservation | Covered |
| Hostile successor | Migration amount only | Existing successor gate remains separately applicable | Not rerun in this focused pass |
| Pause/emergency | No authority-model change | Local sales-pause smoke | Covered |
| Slither | Yes | Rerun after final candidate source settles | Completed: no Critical or High finding; reviewed Medium/Low/Informational detector output is recorded in `post-admin-production-candidate.md` |
| Gas/scale | Yes | Remeasure constructor/buy/configuration path after final source settles | Completed locally: `buyTicket` 245,776, `openNextRound` 183,026, `executeMigration` 146,451 gas; bounded settlement(200) 5,395,321 gas |

No test weakens a production invariant to accommodate a mock.  Rejected token
behaviors are required to leave all independent accounting fields unchanged.
