# Contract source comparison and automation safety follow-up

Audit date: 2026-09-15. This is a read-only evidence record. It does not add an administrator ABI to the public frontend, make an `eth_sendTransaction`, or call any draw function.

## Evidence classification

- **VERIFIED:** reproducible deployment/bytecode/read evidence already recorded in [onchain-verification.md](onchain-verification.md) or a documented explorer transaction/source record.
- **REPORTED SOURCE:** assertion in the owner-provided recovery report; source files, compiler input, and metadata hash have not been supplied to this workspace.
- **UNVERIFIED:** cannot be demonstrated from the current public minimal ABI/runtime evidence.
- **UNAVAILABLE:** BNB lacks reproducible source/creation evidence in the current audit.

## Recovered source inventory

The owner supplied five modern VRF v2.5 source variants. Their SHA-256 digests are retained as audit evidence; the files are not committed to this public frontend repository.

| Network | Contract name | SHA-256 |
|---|---|---|
| Polygon | `MegaCryptoLottery` | `a73bda0280017241ae1e3a16f2398c0a694ae63b6062c2fff87ad23c416c1c23` |
| Arbitrum One | `MegaCryptoLotteryArbitrum` | `62862f720e27c6866ef171f46ba4725b8119c6edd0bb08438f5f880ec310f531` |
| Base | `MegaCryptoLotteryBase` | `0b148fe930d52d910d40ddd9a8051b4c6032f7639756fe25a26559460b0190eb` |
| Optimism | `MegaCryptoLotteryOptimism` | `93474879245334cd3797ecf8e5c93c5f92e7b913f507e904cd598f2c646a3fb5` |
| Avalanche | `MegaCryptoLotteryAvalanche` | `2793d216886e21c59be522b493524ce169fcc2eaf09cad9b8379357efb9ca67c` |

An extra pasted `MegacryptoArbitrum` file is an older, materially different stub (custom owner field, incomplete VRF request, different manual result processing). It is **not** one of the five recovered modern deployment candidates and was excluded from the comparison.

## Runtime and source compatibility

| Network | Deployment/runtime | Recovered-source text supplied | `solicitarSorteio` / manual selector proven against runtime | Classification |
|---|---|---|---|---|
| Polygon | VERIFIED non-empty code, runtime hash, and Blockscout “exact match” source verification | Present | `solicitarSorteio` `0x9b61bfea`; manual `0x35e0388b`; VRF/ownership getters shown in deployed ABI | **MATCH VERIFIED** |
| Arbitrum One | VERIFIED non-empty code, runtime hash, source/deployment evidence in prior audit | Present | Direct current selector interrogation not reproduced in this session | **LIKELY MATCH** |
| Base | VERIFIED non-empty code, runtime hash, source/deployment evidence in prior audit | Present | Direct current selector interrogation not reproduced in this session | **LIKELY MATCH** |
| Optimism | VERIFIED non-empty code, runtime hash, source/deployment evidence in prior audit | Present | Direct current selector interrogation not reproduced in this session | **LIKELY MATCH** |
| Avalanche | VERIFIED non-empty code, runtime hash, SnowTrace deployment/source evidence in prior audit | Present | Direct current selector interrogation not reproduced in this session | **LIKELY MATCH** |
| BNB Smart Chain | VERIFIED non-empty code and recorded runtime hash | No | UNAVAILABLE | VERIFICATION PENDING |

Polygon’s public Blockscout record now reports `MegaCryptoLottery`, compiler `0.8.34`, source code “verified (exact match),” and the constructor arguments. The supplied file’s `pragma ^0.8.20` permits that compiler version. This is stronger than a bytecode hash but does not make the other networks byte-for-byte matches without their equivalent current evidence.

## Ownership audit

The recovered modern sources inherit `VRFConsumerBaseV2Plus`. Polygon’s exact verified dependency source shows its `ConfirmedOwner` → `ConfirmedOwnerWithProposal` ownership chain. The deployed Polygon ABI exposes `owner()` (`0x8da5cb5b`), `transferOwnership(address)` (`0xf2fde38b`), and `acceptOwnership()` (`0x79ba5097`). It is a two-step proposal/acceptance model; the pending-owner storage is private and no public `pendingOwner()` getter is exposed by this ABI. There is no `renounceOwnership()` in the supplied modern source or exposed Polygon ABI.

The actual owner values below remain unverified because the public explorer’s current Read/Write view requires a wallet connection and this audit does not connect a wallet. No owner-changing call was attempted.

| Network | Current owner (full / shortened) | Ownership mechanism | Renounced / pending owner / transfer support |
|---|---|---|---|
| Polygon | UNVERIFIED | UNVERIFIED | UNVERIFIED |
| Arbitrum One | UNVERIFIED | UNVERIFIED | UNVERIFIED |
| Base | UNVERIFIED | UNVERIFIED | UNVERIFIED |
| Optimism | UNVERIFIED | UNVERIFIED | UNVERIFIED |
| Avalanche | UNVERIFIED | UNVERIFIED | UNVERIFIED |
| BNB Smart Chain | UNAVAILABLE | UNAVAILABLE | UNAVAILABLE |

Before ownership is reported, reproduce the exact inherited OpenZeppelin/Chainlink ownership version from the source metadata, then perform `eth_call` against its verified getter(s) on every chain. Never infer the owner from deployer, explorer labels, or a common address.

## Recovered-source draw behavior

All five supplied modern source files contain:

```solidity
function solicitarSorteio() external onlyOwner
function simularSorteioManual(uint256 sementeManual) external onlyOwner
```

and that `solicitarSorteio` requires `apostasDaSemana.length > 0`, requests VRF v2.5 randomness, writes `lastRequestId`, and emits `SorteioSolicitado(lastRequestId)`; fulfillment calls `_processarSorteio(requestId, randomWords[0])`; manual contingency derives a local word and calls `_processarSorteio(0, randomWord)`.

At source level, `solicitarSorteio` requires `apostasDaSemana.length > 0`, constructs `VRFV2PlusClient.RandomWordsRequest`, calls `s_vrfCoordinator.requestRandomWords`, writes `lastRequestId`, and emits `SorteioSolicitado`. `fulfillRandomWords` calls `_processarSorteio(requestId, randomWords[0])`. Manual contingency requires tickets, derives a word using caller seed, `block.timestamp`, and `block.prevrandao`, then calls `_processarSorteio(0, randomWord)`.

Polygon’s exact verified ABI independently exposes the normal/manual selectors, `lastRequestId`, `s_subscriptionId`, `keyHash`, `callbackGasLimit`, `requestConfirmations`, `numWords`, `payWithNative`, `s_vrfCoordinator`, and all three ownership functions above. It also exposes mutable configuration setters including `setCoordinator`, `setSubscriptionId`, `setKeyHash`, `setCallbackGasLimit`, `setNativePayment`, price/percentage/wallet setters, and transfer ownership. Those write methods are deliberately not added to V2’s public frontend ABI.

## Pending-request and ticket-cutoff assessment

**SECURITY CONCERN — VERIFIED in recovered source and MATCH VERIFIED for Polygon; LIKELY for the other four recovered variants.** There is only `lastRequestId`; no `requestPending`, request-to-round mapping, or ticket snapshot exists. Therefore:

1. The owner can request two VRF draws before the first callback. The later callback might process an empty, replaced, or newly populated live ticket array depending on `_processarSorteio` behavior.
2. Tickets bought after a request but before fulfillment may be included in the earlier request because fulfillment reads live `apostasDaSemana`, rather than a frozen round snapshot.
3. A UI purchase pause or a keeper-side “draw closed” flag is only a **UX/operational mitigation**. Direct calls to `comprarBilhete` would remain possible unless the deployed contract enforces closure.
4. A request/result event pair alone is insufficient to prove a safe round mapping without a contract-provided request-to-round identifier/snapshot.

For Polygon, the exact deployed source/ABI result makes this a verified business-logic limitation. For Arbitrum, Base, Optimism, and Avalanche it remains likely until each current source/ABI record is reproduced in this audit. It is a high-priority blocker for unattended automation on all five.

## Manual contingency assessment

The recovered manual entropy is derived from caller-supplied `sementeManual`, `block.timestamp`, and `block.prevrandao`; it is not Chainlink VRF. An owner can choose a seed before submission; block producers may have limited influence over block attributes; and an operator controls timing. It is a trust-based emergency contingency, not cryptographically fair randomness. The frontend must show `Manual Contingency` for `requestId == 0`, never “Chainlink-verified randomness.”

## Schedule and direct Automation

The recovered modern sources contain no `lastDrawTimestamp`, `nextDrawTimestamp`, draw interval, deadline, round-close, pause, or ticket-sales-close state. The only normal-request gate is nonempty `apostasDaSemana`. Thus **DRAW SCHEDULE IS NOT ENFORCED BY THE CURRENT CONTRACT** in the recovered source. An off-chain scheduler chooses when to request; contracts cannot self-execute on time.

If `solicitarSorteio` is actually `onlyOwner`, a Chainlink Automation registry, Automation forwarder, or wrapper cannot satisfy `msg.sender == owner` unless ownership is explicitly transferred to that exact caller or the contract contains a verified authorization mechanism. No such mechanism is confirmed. A multisig owner also cannot normally originate autonomous calls without a separately authorized executor.

## Architectures (design only)

### A — existing contracts, only after verification

Use a server-side, dedicated **owner** keeper only if read-only owner/selector verification succeeds. Keep its signing material in managed HSM/secret infrastructure, never in React, GitHub Pages, CI build variables, browser storage, or public bundles. Restrict it to an exact chain/contract allowlist; use redundant RPCs, fixed chain-ID verification, preflight `eth_call`, a durable nonce lock, receipt/finality monitoring, native-gas/subscription alerts, and incident alerting.

Run an off-chain state machine: `OPEN → DRAW DUE → REQUESTING → VRF REQUESTED → WAITING → COMPLETED`. Reconstruct pending state from `SorteioSolicitado(nonzero requestId)`, a matched `SorteioRealizado(requestId, ...)`, and `lastRequestId` only after confirming the events and state are complete. This operational lock cannot protect against direct owner calls or another authorized actor; it is weaker than an on-chain lock.

### B — future hardened contract

If the reported risks are confirmed, a future deployment should include an on-chain draw interval, explicit round ID, betting-close/snapshot before request, `requestPending`, `requestId → round` mapping, `checkUpkeep`/`performUpkeep`, timeout/recovery, role-based automation executor, emergency pause, manual-contingency delay/reason event, and immutable method/evidence fields. This is a design recommendation only—not a redeploy decision.

## Required evidence to complete the audit

1. The recovered Solidity files and compiler standard JSON input for each of the five networks.
2. Creation bytecode/metadata/constructor arguments or verified explorer source that maps the source to each deployed runtime.
3. Read-only `eth_call` results for all declared administrative/read methods: `owner`, transfer/pending ownership getters, `lastRequestId`, subscription/key-hash/callback/confirmation/word/payment getters, pause/round/timing/pending state, and any roles.
4. BNB’s independently retrievable verified source and creation evidence.

Until this evidence exists, direct Automation compatibility, current ownership, pending-request protection, ticket cutoff, and no-redeploy feasibility remain **UNVERIFIED**.

## 2026-09-16 public-RPC runtime verification

This follow-up used only `eth_getCode` and `eth_call` against the configured public RPC endpoints. It did not connect a wallet, construct an `eth_sendTransaction`, call a write selector (including via `eth_call`), sign, or change state.

### Current owners

All six `owner()` reads returned the same current address:

| Network | `owner()` result | Status |
|---|---|---|
| Polygon | `0x15618583C06399c8EB2dDfbBd935892184368F8A` | VERIFIED by `eth_call` |
| Arbitrum One | `0x15618583C06399c8EB2dDfbBd935892184368F8A` | VERIFIED by `eth_call` |
| Base | `0x15618583C06399c8EB2dDfbBd935892184368F8A` | VERIFIED by `eth_call` |
| Optimism | `0x15618583C06399c8EB2dDfbBd935892184368F8A` | VERIFIED by `eth_call` |
| Avalanche | `0x15618583C06399c8EB2dDfbBd935892184368F8A` | VERIFIED by `eth_call` |
| BNB Smart Chain | `0x15618583C06399c8EB2dDfbBd935892184368F8A` | VERIFIED by `eth_call`; source remains pending |

The owner is the same across all six chains at the queried `latest` blocks. The two-step Chainlink `ConfirmedOwnerWithProposal` ownership mechanism is source/ABI verified for Polygon and supported by the common ownership selectors on the other runtimes. No current pending-owner value was read because no public getter is exposed in the audited ABI.

### Selector and getter results

For Polygon, Arbitrum, Base, Optimism, and Avalanche, every one of the following getter `eth_call`s succeeded: `owner`, `lastRequestId`, `s_subscriptionId`, `keyHash`, `callbackGasLimit`, `requestConfirmations`, `numWords`, and `payWithNative`. All returned `lastRequestId = 0`, `requestConfirmations = 3`, `numWords = 1`, and `payWithNative = true` at the queried blocks. Callback gas is 1,000,000 on Polygon and 500,000 on the other four.

`eth_getCode` for each of those five runtimes contains the dispatcher selectors below. To honor the read-only audit rule, no write selector was executed or simulated:

| Function | Selector | Polygon | Arbitrum | Base | Optimism | Avalanche |
|---|---|---:|---:|---:|---:|---:|
| `solicitarSorteio()` | `0x9b61bfea` | present | present | present | present | present |
| `simularSorteioManual(uint256)` | `0x35e0388b` | present | present | present | present | present |
| `owner()` | `0x8da5cb5b` | call succeeded | call succeeded | call succeeded | call succeeded | call succeeded |
| `transferOwnership(address)` | `0xf2fde38b` | present | present | present | present | present |
| `acceptOwnership()` | `0x79ba5097` | present | present | present | present | present |
| `lastRequestId()` | `0xfc2a88c3` | call succeeded | call succeeded | call succeeded | call succeeded | call succeeded |
| `s_subscriptionId()` | `0x8ac00021` | call succeeded | call succeeded | call succeeded | call succeeded | call succeeded |
| `keyHash()` | `0x61728f39` | call succeeded | call succeeded | call succeeded | call succeeded | call succeeded |
| `callbackGasLimit()` | `0x24f74697` | call succeeded | call succeeded | call succeeded | call succeeded | call succeeded |
| `requestConfirmations()` | `0xb0fb162f` | call succeeded | call succeeded | call succeeded | call succeeded | call succeeded |
| `numWords()` | `0x7ccfd7fc` | call succeeded | call succeeded | call succeeded | call succeeded | call succeeded |
| `payWithNative()` | `0x38b28e1d` | call succeeded | call succeeded | call succeeded | call succeeded | call succeeded |

Bytecode selector presence plus successful read calls verifies the public runtime surface, but it is not a compiler metadata/source-byte-for-byte comparison. Therefore Arbitrum, Base, Optimism, and Avalanche remain **LIKELY MATCH**, not `MATCH VERIFIED`; Polygon remains `MATCH VERIFIED` through its explorer’s exact-source verification.

BNB returns the same owner and has non-empty code containing the complete selector set above. This is valuable runtime ABI evidence, but no reproducible verified source/creation artifact was recovered, so BNB remains **VERIFICATION PENDING** and is not assumed to share the five-source business logic.

