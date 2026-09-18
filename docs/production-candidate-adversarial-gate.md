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

