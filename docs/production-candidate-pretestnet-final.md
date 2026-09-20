# Final local pre-testnet technical gate

> Historical record: the frozen hashes below were superseded by the
> mask-compatible candidate documented in [mask-compatibility.md](mask-compatibility.md).
> This record is retained for its prior gate evidence only.

## Decision

**GO — local technical gate only.** This is not authorization to deploy, create
or fund a Chainlink subscription, use a wallet, or perform any public-chain
action. A separate reviewed authorization is required before any testnet step.

## Frozen candidate and reproducible build

| Artifact | SHA-256 | Result |
| --- | --- | --- |
| Source | `7a0864029420637eaf8635da405ce70ccfbe08f4abf2d5d7f1751b2cb1745e24` | PASS |
| ABI | `fb2631608e3aef666dfb2013035678a6aec562581dece30a44ee77b5f8c776f3` | PASS |
| Creation bytecode | `56b4a1a21d412f24ed7fa50295e08bb42fc3025b20fdcf18475cdddbad0d8a98` | PASS |
| Runtime bytecode | `ed8eff46cf8fcf290ff95869fea064ef3fec3fb874523b2203e12388ad6373ff` | PASS |

Reproduce with `npm run compile:production`. The committed compiler script
resolves package imports directly from `contracts-v2/node_modules`, not from a
copy or documentation declaration. The actual package manifests resolve to:

| Item | Evidence |
| --- | --- |
| Compiler | `solc` package `0.8.28` |
| Optimizer | enabled, 200 runs |
| EVM | `shanghai` |
| IR pipeline | `viaIR: true` |
| Chainlink | `@chainlink/contracts` package `1.5.0`; imports include `VRFConsumerBaseV2Plus.sol`, `VRFV2PlusClient.sol`, and `AutomationCompatibleInterface.sol` |
| OpenZeppelin | `@openzeppelin/contracts` package `5.6.1`; imports include `SafeERC20.sol`, `IERC20.sol`, and `ReentrancyGuard.sol` |

The regenerated ABI, creation bytecode, and runtime bytecode match the frozen
hashes above. Compilation emitted no Solidity compiler warning.

## Deployment size

| Measure | Bytes | Limit | Remaining | Result |
| --- | ---: | ---: | ---: | --- |
| Creation/initcode | 16,359 | 49,152 (EIP-3860) | 32,793 | PASS |
| Runtime | 14,869 | 24,576 (EIP-170) | 9,707 | PASS |

## Real Slither analysis

Slither `0.11.6` ran locally against
`contracts-production/MegaCryptoLotteryV2ProductionCandidate.sol`, using native
`solc 0.8.28+commit.7893614a.Windows.msvc`, remappings to the installed official
Chainlink/OpenZeppelin packages, `--via-ir --optimize --optimize-runs 200
--evm-version shanghai`, and `--exclude-dependencies`. The reproducible command
from `contracts-v2` is:

```powershell
$env:VIRTUAL_ENV = (Resolve-Path '.\\.slither-venv').Path
$env:Path = "$env:VIRTUAL_ENV\\Scripts;$env:Path"
& .\\.slither-venv\\Scripts\\slither.exe contracts-production\\MegaCryptoLotteryV2ProductionCandidate.sol `
  --solc-remaps '@chainlink/contracts=node_modules/@chainlink/contracts @openzeppelin/contracts=node_modules/@openzeppelin/contracts' `
  --solc-args '--via-ir --optimize --optimize-runs 200 --evm-version shanghai' `
  --exclude-dependencies --json artifacts\\slither-production.json
```

The generated JSON is intentionally ignored as a build artifact.

Slither reported no Critical or High finding. Detector output was reviewed:

| Detector / severity | Count | Disposition |
| --- | ---: | --- |
| `incorrect-equality` / Medium | 3 | Accepted: equality is intentional for completed-state, empty-round, and exact-received-token checks. The exact token receipt check is specifically hostile-token protection. |
| `reentrancy-no-eth` / Medium | 2 | Accepted after local hostile-VRF and hostile-successor coverage. `_request` stages `VRF_REQUESTED`/pending before the coordinator call; `executeMigration` is `nonReentrant` and sets `MIGRATION_READY` before transfer/callback. |
| `uninitialized-local` / Medium | 1 | False positive: Solidity initializes the local `selected` counter in `_winning` to zero. |
| `events-access` / Low | 1 | Informational observability improvement: `setEmergencyAuthority` has no dedicated event. Not an authorization bypass. |
| `reentrancy-benign`, `reentrancy-events` / Low | 2 | Accepted; same staged-request behavior, tested with a hostile authenticated coordinator. |
| `timestamp` / Low | 14 | Accepted operational timing use: round cutoff, VRF timeout, and explicit configuration/migration timelocks. No randomness is derived from `block.timestamp`. |
| assembly, pragma, solc-version, naming, unindexed-event-address / Informational | 23 | Official dependency implementation/version-range and style reports. The actual compile is fixed to 0.8.28 and official dependency versions above. |

No Slither detector finding is classified Critical, High, or an unresolved
technical blocker. Candidate code was not altered in response to the report.

## Inheritance and security-critical behavior

- `VRFConsumerBaseV2Plus` is the constructor-bound coordinator authority.
  Its public raw fulfillment entrypoint authenticates `s_vrfCoordinator` before
  calling the candidate's internal `fulfillRandomWords` override. The candidate
  additionally validates the request-to-round mapping, pending state, request
  ID, and draw method.
- Chainlink `ConfirmedOwner` is inherited through that base. Ownership is
  two-step (`transferOwnership` then `acceptOwnership`), covered by the frozen
  production lifecycle tests.
- `ReentrancyGuard` protects the token-moving purchase, claim, manual
  contingency, and migration execution boundaries; migration has separate
  hostile-successor coverage.
- `SafeERC20` is used for transfers. Purchase also verifies the exact
  post-transfer balance delta, intentionally rejecting unsupported fee/hostile
  token behavior.

## Local gas and bounded scaling

`contracts-v2/scripts/measure-production-candidate-gas.mjs` is the
reproduction harness. It deploys the exact regenerated candidate only into a
local Ganache EVM with a 30,000,000-gas block limit and measures transaction
receipts. It includes the real `MAX_SETTLEMENT_BATCH = 200` settlement path.
The table is completed from the harness output below.

| Operation | Gas used | % of 30,000,000 |
| --- | ---: | ---: |
| buyTicket | 258,261 | 0.86% |
| closeRound | 38,383 | 0.13% |
| requestRandomness | 223,686 | 0.75% |
| coordinator fulfillment transaction | 80,683 | 0.27% |
| manual contingency | 121,573 | 0.41% |
| processSettlement (1) | 125,803 | 0.42% |
| claim | 75,986 | 0.25% |
| openNextRound | 107,637 | 0.36% |
| proposeMigration | 118,120 | 0.39% |
| executeMigration | 146,319 | 0.49% |

| Settlement batch | Gas used | % of 30,000,000 |
| --- | ---: | ---: |
| 1 | 125,803 | 0.42% |
| 10 | 364,006 | 1.21% |
| 100 | 2,746,036 | 9.15% |
| 200 | 5,392,736 | 17.98% |

This is an execution-cost check, not public-chain gas estimation. Exact
production-chain limits and fee markets must be selected and re-measured during
an explicitly authorized testnet readiness step.

### Scale transaction-count analysis

Settlement is bounded by `MAX_SETTLEMENT_BATCH = 200`; this is transaction
count arithmetic, not a claim that these volumes were executed in the local
gas harness.

| Tickets in a completed round | Required settlement transactions |
| ---: | ---: |
| 1,000 | 5 |
| 10,000 | 50 |
| 100,000 | 500 |

## Liveness and operations

On-chain controls do not operate the lottery by themselves. An operator must
monitor and invoke (directly or through separately selected automation): close
after cutoff, request VRF for a closed non-empty round, submit bounded
settlement batches until finalization, and open the next round. The VRF
subscription/native-payment path must be funded and pending requests monitored.
Manual contingency is an emergency-authorized path only after the three-day
on-chain timeout, with recorded reason/evidence. A migration requires the
seven-day timelock and a completed active round; after migration the old
candidate is claims-only. These are off-chain liveness responsibilities, not
an assertion that any automation/CRE is configured.

## Consolidated frozen evidence

| Gate | Result | Published evidence SHA |
| --- | --- | --- |
| Official-import compilation / production lifecycle / ownership | PASS | `47b50a3e4d41f7e1421fc29a3dc23af5d2876c7f` |
| Multi-round accounting (100 campaigns / 500 rounds) | PASS | `b23e2f199de6c691b21bc24352d3014cc6ab8d5d` |
| Hostile token | PASS | `3c72d637446fe2e7a046a2e2aec` |
| Hostile VRF | PASS | `edabd4fcaf5b1b4a902837697147c7be2d4c39dc` |
| Migration liabilities | PASS | `fa69fc4b154c5d31e1613481d8cb0616755d2237` |
| Hostile successor | PASS | `c1e28d09fb62f46a3381d29bda322b0fd737225a` |
| Pause / emergency | PASS | `47b50a3e4d41f7e1421fc29a3dc23af5d2876c7f` |
| Production regressions | PASS (6/6 in every final functional gate) | `47b50a3e4d41f7e1421fc29a3dc23af5d2876c7f` |
| Slither | PASS | this gate |
| Gas / scale | PASS (local receipt measurements; bounded batch of 200) | this gate |

## Consolidated unresolved findings

| ID | Severity | Status | Description |
| --- | --- | --- | --- |
| ADV-INFO-001 | Informational | accepted | The Chainlink coordinator is immutable for this deployment; a future coordinator migration needs the controlled successor lifecycle. |
| ADV-INFO-002 | Informational | accepted | After claims-only migration, reserve storage is historical and must not be reported as funds still held by the old candidate. |
| ADV-INFO-003 | Informational | accepted | Token and chain identity are supplied to and validated by the successor handshake rather than independently stored as candidate comparisons. |
| ADV-INFO-004 | Informational | accepted | An authenticated, already-mapped VRF callback intentionally remains callable while paused. |
| SLITHER-LOW-001 | Low | accepted | Emergency-authority changes have no dedicated event; operational monitoring should track the transaction/owner event trail. |

Unresolved Critical: 0. Unresolved High: 0. Unresolved Medium: 0. Unresolved
Low: 0. No production Solidity was changed. Public-chain actions: **ZERO**.
