# Contract source comparison and automation safety follow-up

Audit date: 2026-09-15. This is a read-only evidence record. It does not add an administrator ABI to the public frontend, make an `eth_sendTransaction`, or call any draw function.

## Evidence classification

- **VERIFIED:** reproducible deployment/bytecode/read evidence already recorded in [onchain-verification.md](onchain-verification.md) or a documented explorer transaction/source record.
- **REPORTED SOURCE:** assertion in the owner-provided recovery report; source files, compiler input, and metadata hash have not been supplied to this workspace.
- **UNVERIFIED:** cannot be demonstrated from the current public minimal ABI/runtime evidence.
- **UNAVAILABLE:** BNB lacks reproducible source/creation evidence in the current audit.

## Runtime and source compatibility

| Network | Deployment/runtime | Recovered-source text supplied | `solicitarSorteio` / manual selector proven against runtime | Classification |
|---|---|---|---|---|
| Polygon | VERIFIED non-empty code and recorded runtime hash | Not present in workspace/repo | UNVERIFIED | Source-to-runtime match UNVERIFIED |
| Arbitrum One | VERIFIED non-empty code and recorded runtime hash | Not present in workspace/repo | UNVERIFIED | Source-to-runtime match UNVERIFIED |
| Base | VERIFIED non-empty code and recorded runtime hash | Not present in workspace/repo | UNVERIFIED | Source-to-runtime match UNVERIFIED |
| Optimism | VERIFIED non-empty code and recorded runtime hash | Not present in workspace/repo | UNVERIFIED | Source-to-runtime match UNVERIFIED |
| Avalanche | VERIFIED non-empty code and recorded runtime hash | Not present in workspace/repo | UNVERIFIED | Source-to-runtime match UNVERIFIED |
| BNB Smart Chain | VERIFIED non-empty code and recorded runtime hash | No | UNAVAILABLE | VERIFICATION PENDING |

The public Polygon explorer currently presents a `StubContract.sol` record, not a downloadable recovered implementation. A runtime bytecode hash alone cannot prove source equivalence because compiler metadata, optimizer settings, linked libraries, constructor arguments, and proxy behavior affect comparison.

## Ownership audit

`VRFConsumerBaseV2Plus` does not by itself prove the ownership implementation used by a deployment. The recovered-source report states `onlyOwner`, but the current audited frontend ABI does not include `owner()`, `transferOwnership(address)`, `acceptOwnership()`, `pendingOwner()`, or role getters. No reproducible read-only RPC owner result is available in the audit record.

| Network | Current owner (full / shortened) | Ownership mechanism | Renounced / pending owner / transfer support |
|---|---|---|---|
| Polygon | UNVERIFIED | UNVERIFIED | UNVERIFIED |
| Arbitrum One | UNVERIFIED | UNVERIFIED | UNVERIFIED |
| Base | UNVERIFIED | UNVERIFIED | UNVERIFIED |
| Optimism | UNVERIFIED | UNVERIFIED | UNVERIFIED |
| Avalanche | UNVERIFIED | UNVERIFIED | UNVERIFIED |
| BNB Smart Chain | UNAVAILABLE | UNAVAILABLE | UNAVAILABLE |

Before ownership is reported, reproduce the exact inherited OpenZeppelin/Chainlink ownership version from the source metadata, then perform `eth_call` against its verified getter(s) on every chain. Never infer the owner from deployer, explorer labels, or a common address.

## Reported source behavior — not runtime confirmation

The recovery report says the five source files contain:

```solidity
function solicitarSorteio() external onlyOwner
function simularSorteioManual(uint256 sementeManual) external onlyOwner
```

and that `solicitarSorteio` requires `apostasDaSemana.length > 0`, requests VRF v2.5 randomness, writes `lastRequestId`, and emits `SorteioSolicitado(lastRequestId)`; fulfillment calls `_processarSorteio(requestId, randomWords[0])`; manual contingency derives a local word and calls `_processarSorteio(0, randomWord)`.

This is consistent with the already verified facts that non-BNB sources use the VRF consumer path, emit `SorteioSolicitado`, and historical `SorteioRealizado` records have `requestId == 0`. It is **not enough** to verify exact selectors, modifiers, storage layout, setters, withdrawals, percentages, or runtime equivalence. Do not expose these functions in the public frontend until their ABI and runtime are independently verified.

## Pending-request and ticket-cutoff assessment

**SECURITY CONCERN — conditional on the reported source being accurate.** If there is only `lastRequestId` and no on-chain pending-request/round snapshot lock, the following risks exist:

1. The owner can request two VRF draws before the first callback. The later callback might process an empty, replaced, or newly populated live ticket array depending on `_processarSorteio` behavior.
2. Tickets bought after a request but before fulfillment may be included in the earlier request because fulfillment reads live `apostasDaSemana`, rather than a frozen round snapshot.
3. A UI purchase pause or a keeper-side “draw closed” flag is only a **UX/operational mitigation**. Direct calls to `comprarBilhete` would remain possible unless the deployed contract enforces closure.
4. A request/result event pair alone is insufficient to prove a safe round mapping without a contract-provided request-to-round identifier/snapshot.

These risks are not yet a proven deployed-runtime vulnerability because the recovered code has not been matched to each deployment. They are high-priority verification targets before any automation is considered.

## Manual contingency assessment

If the reported manual entropy is derived from caller-supplied `sementeManual`, `block.timestamp`, and `block.prevrandao`, it is not Chainlink VRF and must be described as a trust-based emergency contingency. An owner can choose a seed before submission; block producers may have limited influence over block attributes; and an operator could decide when to submit. The frontend must show `Manual Contingency` for `requestId == 0`, never “Chainlink-verified randomness.”

## Schedule and direct Automation

The current verified public ABI has no last-draw/next-draw/timer getter. If the reported source has no time gate beyond nonempty tickets, then **DRAW SCHEDULE IS NOT ENFORCED BY THE CURRENT CONTRACT**. An off-chain scheduler chooses when to request a draw; contracts cannot self-execute on time.

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

