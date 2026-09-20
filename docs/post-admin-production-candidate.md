# Post-admin production-candidate record

## Status and scope

`MegaCryptoLotteryV2ProductionCandidate` is a **post-admin-controls local
production candidate**, identified by `CANDIDATE_VERSION =
"POST_ADMIN_CONTROLS_V1"`. It supersedes the previous frozen candidate only
for local review and is not deployment authorization.

The source is one common Solidity implementation for Polygon, BNB Chain,
Arbitrum, Base, Optimism, and Avalanche. Network differences are only
constructor/deployment inputs: payment token/decimals, constructor-bound VRF
coordinator/configuration, and operational wallets.

## Reproducible compiler inputs

| Item | Value |
| --- | --- |
| Source | `contracts-v2/contracts-production/MegaCryptoLotteryV2ProductionCandidate.sol` |
| Solidity | `0.8.28` |
| Optimizer | enabled, 200 runs |
| IR pipeline | `viaIR: true` |
| EVM | Shanghai |
| Chainlink | `@chainlink/contracts` 1.5.0 |
| OpenZeppelin | `@openzeppelin/contracts` 5.6.1 |

Compile with `npm run compile:production` from `contracts-v2`; the build uses
official installed package imports and has no Solidity compiler errors.

## Hash transition

**PRE-ADMIN FROZEN HASHES** remain historical evidence:

| Artifact | SHA-256 |
| --- | --- |
| Source | `7a0864029420637eaf8635da405ce70ccfbe08f4abf2d5d7f1751b2cb1745e24` |
| ABI | `fb2631608e3aef666dfb2013035678a6aec562581dece30a44ee77b5f8c776f3` |
| Creation bytecode | `56b4a1a21d412f24ed7fa50295e08bb42fc3025b20fdcf18475cdddbad0d8a98` |
| Runtime bytecode | `ed8eff46cf8fcf290ff95869fea064ef3fec3fb874523b2203e12388ad6373ff` |

**POST-ADMIN HASHES** for `POST_ADMIN_CONTROLS_V1` are superseded by the
mask-compatibility candidate below. They remain historical evidence only.

**MASK-COMPATIBILITY HASHES** for the current candidate:

| Artifact | SHA-256 | Size |
| --- | --- | ---: |
| Source | `dcf7b58db6ad8c4d2e0640e85437bd6cab8ea64d6aa24a1469964d06d6f2e564` | — |
| ABI | `0199f62a2caa3712a0ea04fe939a7c6921076f3959b23db942a7352135070fb2` | — |
| Creation bytecode | `5182efc9d03fc2ce2452fbf22bad398e42a0eb4f64b2ed33d462c033cc5853cf` | 21,115 bytes |
| Runtime bytecode | `9166c142313b2eebc9b0d24cf1361a1505e77206aea6d59a00002490a4a12199` | 18,428 bytes |

The runtime is below EIP-170's 24,576-byte limit and creation bytecode below
EIP-3860's 49,152-byte initcode limit.

## Ticket-mask compatibility

The candidate preserves the verified legacy/frontend convention: lottery
number `n` uses bit `n`, for `n = 1..25`; bit `0` is reserved and invalid.
Winning masks select fifteen unique bits from that same inclusive range. See
[mask-compatibility.md](mask-compatibility.md) for source evidence and local
compatibility coverage.

## Controls and accounting

- A two-day delayed future-round configuration stages price, duration, all four
  BPS values, and both operational wallets. BPS must total exactly 10,000.
- Initial intended economics are 50/38/6/6:
  5,000/3,800/600/600 BPS.
- Each round snapshots the full economics and VRF configuration version at
  opening; later activations cannot mutate an open or historical round.
- Purchases atomically collect the exact ticket price, immediately transfer
  maintenance/oracle shares, retain jackpot/weekly/dust, and reject unsupported
  token behavior without partial accounting.
- No token setter, arbitrary withdrawal, retroactive economics mutation,
  in-place coordinator replacement, or ordinary owner-selected draw exists.

Detailed control inventory: [production-admin-controls.md](production-admin-controls.md).
Legacy comparison: [legacy-vs-v2-admin-controls.md](legacy-vs-v2-admin-controls.md).
Balance/migration specification: [post-admin-accounting.md](post-admin-accounting.md).

No operational recipient was chosen by this repository. Deployment inputs must
remain `PENDING_USER_ADDRESS` for maintenance wallet, oracle wallet, and
emergency authority until reviewed user-controlled addresses are supplied.

## Validation record

| Validation | Result |
| --- | --- |
| Official-import candidate compile | PASS |
| Targeted economics/admin suite | PASS — 11 local Ganache cases |
| Existing production lifecycle suite | PASS — 6 local Ganache cases |
| Historic 500-round gate | intentionally frozen; not automatically rerun in this scoped pass |
| Public-chain actions, signatures, deployments | ZERO |

The targeted suite covers 6/18 decimals; 50/38/6/6, 60/30/5/5, and
40/40/10/10 snapshots; immediate fees; rejected/false-return/fee-on-transfer
tokens; reentrancy; dust; historical claims; rollover; migration liabilities;
pause/emergency; and VRF economic isolation.

## Affected-path local gas record

Local Ganache (30,000,000 block gas limit) receipt measurements for the exact
post-admin bytecode:

| Operation | Post-admin gas | Pre-admin gas | Difference |
| --- | ---: | ---: | ---: |
| `buyTicket` | 245,776 | 258,261 | -12,485 |
| `openNextRound` | 183,026 | 107,637 | +75,389 |
| `executeMigration` | 146,451 | 146,319 | +132 |
| `processSettlement(200)` | 5,395,321 | 5,392,736 | +2,585 |

`buyTicket` now performs two real operational fee transfers. Its total local
receipt cost nevertheless decreased relative to the pre-admin artifact because
the prior retained-maintenance/oracle storage accounting was removed; this is
not a claim about public-chain fee pricing. The larger `openNextRound` cost is
the explicit full economics snapshot event and added snapshot storage. These
measurements are local EVM evidence only.

## Static-analysis disposition

Slither 0.11.6 was run with the compiler settings above and official import
remappings. No Critical or High result was reported. Exact balance equality is
intentional hostile-token protection. VRF/migration reentrancy notices are
pre-existing staged/guarded paths covered by hostile local tests. Timestamp
findings are intentional cutoff, timeout, and timelock controls; no timestamp
randomness is used. The `_winning` local-counter report is a Solidity
zero-initialization false positive. Dependency pragma/assembly/naming reports
come from official dependencies. Event-indexing reports are informational.
