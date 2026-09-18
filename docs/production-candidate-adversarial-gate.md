# Production candidate adversarial gate

## VRF coordinator configuration limitation

`MegaCryptoLotteryV2ProductionCandidate` inherits Chainlink
`VRFConsumerBaseV2Plus`. Its coordinator is fixed by the constructor through
the inherited `s_vrfCoordinator`. Future configuration proposals explicitly
require the same coordinator address, so a foreign coordinator proposal
reverts with `COORDINATOR_SNAPSHOT`.

This is intentional protection, not an in-place coordinator rotation feature.
Future configurations can update only the parameters stored in a new config
version while preserving the constructor-bound coordinator. Pending requests
continue to authenticate through that bound coordinator. Any future Chainlink
coordinator migration requires the controlled successor/migration lifecycle.

Finding `ADV-INFO-001`: informational; coordinator replacement is not
available in-place. Regression coverage is in
`contracts-v2/test/production-candidate.test.mjs`.

## Gate status

## Hostile VRF gate — PASS (local Ganache)

The following five scenarios use the exact production candidate artifact and
the constructor-bound coordinator callback path. They run only against a local
Ganache EVM; no wallet, public RPC, transaction, signature, Automation, or
VRF service is used.

| Scenario | Result | Evidence |
| --- | --- | --- |
| Post-manual late callback | PASS | After a timeout-driven manual contingency and settlement, the authenticated coordinator's original callback reverts; complete draw and independent-accounting snapshots are unchanged. |
| Delayed authenticated callback | PASS | A callback delayed 604,924 seconds while still pending is accepted for only its mapped round, then settles once through `CHAINLINK_VRF`. |
| Callback after completed VRF round | PASS | A second authenticated callback for an already-completed round reverts without changing the result, evidence, settlement cursor, liabilities, reserves, or token balance. |
| Request-time reentrancy | PASS | A hostile local coordinator attempts request, manual contingency, settlement, callback, close, and open-next calls during `requestRandomWords`. State is already `VRF_REQUESTED` with `requestPending=true`; the returned ID and mapping are not yet available, and every attempt is rejected. The legitimate request then fulfills and settles normally. |
| Cross-round isolation | PASS | Round A's completed request cannot affect pending Round B; an unknown ID cannot mutate either. Round B's legitimate request completes only Round B, while Round A's historical snapshot and mapping remain unchanged. |

### Request-time staging evidence

`_request` validates the closed round and coordinator snapshot, then stores
`VRF_REQUESTED`, `requestPending=true`, and `requestedAt` before calling the
coordinator. Only after that call returns does it validate and store the
returned `requestId` and `requestIdToRoundId` mapping. Thus an authenticated
callback made *inside* `requestRandomWords` reaches the consumer's coordinator
authentication path but fails with `UNKNOWN_REQUEST`: the prospective ID has
no mapping yet. Lifecycle calls are independently constrained by their state
and authorization checks.

The local harness records both the staged round fields and each captured revert
payload. It does not alter candidate code or production coordinator behavior.

### Frozen candidate verification

The Hostile VRF suite and the six production regressions passed with these
unchanged candidate hashes:

| Artifact | SHA-256 |
| --- | --- |
| Source | `7a0864029420637eaf8635da405ce70ccfbe08f4abf2d5d7f1751b2cb1745e24` |
| ABI | `fb2631608e3aef666dfb2013035678a6aec562581dece30a44ee77b5f8c776f3` |
| Creation bytecode | `56b4a1a21d412f24ed7fa50295e08bb42fc3025b20fdcf18475cdddbad0d8a98` |
| Runtime bytecode | `ed8eff46cf8fcf290ff95869fea064ef3fec3fb874523b2203e12388ad6373ff` |

The wider adversarial gate remains incomplete: migration-liability,
hostile-successor, complete pause/emergency, and other required suites must
still pass before the overall production-candidate adversarial gate can pass.

## Migration liabilities gate — PASS (local Ganache)

The migration-liability suite uses the exact production candidate, a standard
local ERC-20, the local ABI-compatible VRF coordinator, and a handshake-valid
successor receiver. It creates three fully completed rounds with five tickets:

- Round 1: two unclaimed jackpot winners.
- Round 2: an additional unclaimed jackpot winner for a Round-1 winner.
- Round 3: two tied, unclaimed weekly-pool winners and a remaining jackpot
  reserve.

Before migration, independently calculated values were:

| Item | Amount (6-decimal token units) |
| --- | ---: |
| Old-contract token balance | 25,000,000 |
| Outstanding player liabilities | 17,000,000 |
| Jackpot reserve | 5,000,000 |
| Maintenance reserve | 1,500,000 |
| Oracle reserve | 1,500,000 |
| Unallocated percentage dust | 0 |
| Active weekly reserve | 0 |
| Exact legally migratable amount | 8,000,000 |

The amount is derived from the candidate's actual rule:
`migratableBalance = max(tokenBalance - playerLiabilities, 0)`. Therefore the
candidate retains the entire 17,000,000 liability balance in the old contract
and transfers the 8,000,000 non-liability balance after the seven-day timelock
and completed-round gate. The successor records exactly that amount.

After migration the old contract enters `MIGRATED_CLAIMS_ONLY`; sales fail, but
claims remain enabled. The suite claims later Round 2 before Round 1, makes the
same wallet claim three separate historical rounds, claims two other winners,
and rejects a duplicate claim. After every claim it independently verifies the
winner token transfer, decreases in old-contract balance and
`playerLiabilities`, and that the remaining old-contract balance equals exactly
the remaining player liability.

The completed-round reserves remain visible in old-contract storage because
the candidate does not clear reserve variables during migration; they are the
contract's explicitly permitted migrated amount and are not retained claim
liabilities in claims-only mode. This is documented behavior, not a transfer of
earned player claims.

Separate fixtures prove `executeMigration` fails atomically after the timelock
when the current round is OPEN, CLOSED, VRF_REQUESTED, or in incomplete
SETTLEMENT. In every case, the receiver receives nothing and balances,
liabilities, reserves, and migration state remain unchanged.

Finding `ADV-INFO-002`: reserve storage values are historical after
`MIGRATED_CLAIMS_ONLY`; downstream reporting must distinguish them from funds
held by the old contract. No Critical, High, Medium, or Low migration-accounting
defect was found by this local gate.

The wider adversarial gate remains incomplete: hostile-successor and remaining
pause/emergency coverage must still pass before the overall production-candidate
adversarial gate can pass.

## Hostile successor gate — PASS (local Ganache)

The hostile-successor suite begins with a completed jackpot round containing a
real unclaimed `playerLiabilities` balance of 4,400,000 token units. Its
old-contract balance is 5,000,000, so the exact candidate rule permits only
600,000 to migrate and leaves the 4,400,000 claim liability in the old
contract.

| Successor scenario | Result | Exact protection |
| --- | --- | --- |
| Zero address | PASS | `proposeMigration` rejects `address(0)`. |
| EOA | PASS | `code.length > 0` rejects non-contract targets. |
| Wrong magic | PASS | The returned `migrationReceiverMagic` differs from `MIGRATION_MAGIC`. |
| Wrong token / chain | PASS | The candidate supplies `address(usdt)` and `block.chainid` to the receiver handshake; a receiver configured for another value returns an invalid magic value and is rejected. |
| Malformed ABI response | PASS | ABI decoding of the handshake result reverts atomically. |
| Validation revert | PASS | A reverting handshake cannot propose a migration. |
| Fake-compatible receipt revert | PASS | `receiveMigration` reversion rolls back the SafeERC20 transfer and every migration-state change. |
| Fake-compatible reentrancy | PASS | `executeMigration` is `nonReentrant`; attempted reentry is rejected. Attempts to propose are blocked by ownership and attempts to claim are blocked by ticket ownership. |
| Duplicate migration | PASS | `MIGRATED_CLAIMS_ONLY` prevents a second execution or receipt. |
| Post-migration historical claim | PASS | The old contract retains the exact liability balance, pays the historical winner, and rejects a duplicate claim. |

Every failed proposal/execution uses independent snapshots of old and successor
token balances, player liabilities, all reserve fields, migration state,
successor configuration, and historical claim entitlement. The snapshots remain
unchanged after each expected failure. The valid reentrant-receiver execution
transfers only the independently calculated non-liability balance; it cannot
obtain the retained player claim funds.

Finding `ADV-INFO-003`: token and chain identity are inputs to the public
receiver handshake, not separate candidate-side storage comparisons. A receiver
can and should validate those supplied values; a receiver configured for a
different token or chain fails the handshake. No Critical, High, Medium, or Low
hostile-successor defect was found by this local gate.

The wider adversarial gate remains incomplete: remaining pause/emergency and
other required suites must still pass before the overall production-candidate
adversarial gate can pass.

## Pause / emergency authority gate — PASS (local Ganache)

The pause/emergency suite uses distinct owner, emergency-authority, player,
attacker, replacement-authority, and pending-owner accounts. It verifies the
candidate's exact boundary rather than treating pause as a blanket freeze:

| Scenario | Result | Evidence |
| --- | --- | --- |
| Authority separation | PASS | Only the owner can rotate emergency authority, transfer ownership, configure VRF, or propose migration. An attacker has neither role. |
| OPEN pause / recovery | PASS | Pause blocks ticket sales without moving tickets, token balance, reserves, or liabilities; unpause resumes normal sales. |
| Earned claims while paused | PASS | `claim` is intentionally not pause-gated. The historical winner receives the exact entitlement; liabilities and old balance fall equally; duplicate claim fails. |
| CLOSED / VRF_REQUESTED pause | PASS | Pause blocks `requestRandomness`, but the authenticated coordinator callback is intentionally allowed and produces exactly one mapped result. |
| SETTLEMENT pause | PASS | Pause freezes the settlement cursor and accounting; unpause resumes bounded settlement to completion. |
| Manual contingency | PASS | Unauthorized and pre-timeout calls fail. After `VRF_TIMEOUT`, emergency authority records `MANUAL_CONTINGENCY` with reason/evidence; the original coordinator callback cannot overwrite it. |
| Authority rotation / ownership | PASS | Old authority loses pause power immediately, replacement gains only emergency power, and two-step ownership transfer neither grants pending-owner powers early nor silently rotates emergency authority. |
| Claims-only interaction | PASS | After migration, pause/emergency operations cannot reopen sales, lifecycle, draw, or migration; the paused historical claim remains payable and non-duplicable. |

Rejected operations are checked with independent snapshots of token balance,
liabilities, reserve fields, weekly pool, ticket count, settlement cursor, and
round state. No Critical, High, Medium, or Low pause/emergency defect was found
by this local gate.

Finding `ADV-INFO-004`: authenticated Chainlink callback delivery is not
pause-gated, by design. Pause blocks new lifecycle entry and settlement while
allowing a legitimate pending callback to record exactly its bound result; this
avoids a pause-created VRF liveness failure without weakening mapping/state
guards.

