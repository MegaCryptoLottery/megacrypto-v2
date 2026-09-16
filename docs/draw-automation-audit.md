# Draw automation audit (read-only)

Audit date: 2026-09-15. Scope: the six deployed MegaCrypto Lottery contracts and their verified/public explorer artifacts. This audit did **not** send a transaction, sign a message, request VRF randomness, register an upkeep, or change any production code.

## Evidence standard

`VERIFIED` below means an item is supported by the deployment/contract source evidence recorded in [draw-history-vrf-audit.md](draw-history-vrf-audit.md), a read-only RPC call, or a linked explorer record. `UNVERIFIED` is deliberately not filled in from names, bytecode guesses, or a frontend ABI. The V2 production ABI is intentionally a minimal user-facing surface; it is **not** a complete administrator/draw ABI.

The five non-BNB deployments have verified source evidence that imports `VRFConsumerBaseV2Plus` / `VRFV2PlusClient`, calls `s_vrfCoordinator.requestRandomWords`, emits `SorteioSolicitado(requestId)`, and handles the result through `fulfillRandomWords`. Source evidence also shows the emergency path invokes the common draw processor with request ID `0`. BNB source/creation evidence remains unavailable reproducibly and is not assumed equivalent.

## Deployment and VRF matrix

| Network | Lottery | Coordinator | Source integration | Subscription / key hash / gas / confirmations / words / payment | Request and fulfillment evidence |
|---|---|---|---|---|---|
| Polygon | `0x171c…132C` | `0x5c210ef41cd1a72de73bf76ec39637bb0d3d7bee` | VERIFIED, VRF v2.5 consumer path | UNAVAILABLE from the audited public artifact | `SorteioSolicitado`; source calls coordinator and implements fulfillment. Historical completed draws are request ID 0 only. |
| BNB Smart Chain | `0xC190…AC33` | UNVERIFIED | VERIFICATION PENDING | UNAVAILABLE | No reproducible verified source/creation retrieval during this audit. |
| Arbitrum One | `0x162F…68ee` | `0x3c0ca683b403e37668ae3dc4fb62f4b29b6f7a3e` | VERIFIED, VRF v2.5 consumer path | UNAVAILABLE | Same verified source behavior; discovered draw is request ID 0. |
| Base | `0x0fBF…6eeB` | `0xd5d517abe5cf79b7e95ec98db0f0277788aff634` | VERIFIED, VRF v2.5 consumer path | UNAVAILABLE | Same verified source behavior; discovered draw is request ID 0. |
| Optimism | `0x73B5…04b0` | `0x05fe58960f730153eb5a84a47c51bd4e58302e1c8` | VERIFIED, VRF v2.5 consumer path | UNAVAILABLE | Same verified source behavior; discovered draw is request ID 0. |
| Avalanche | `0x0fBF…6eeB` | `0xe40895d055bccd2053dd0638c9695e326152b1a4` | VERIFIED, VRF v2.5 consumer path | UNAVAILABLE | Same verified source behavior; discovered draw is request ID 0. |

The exact deployment transactions, audited start blocks, and source links are in [draw-history-vrf-audit.md](draw-history-vrf-audit.md). The source evidence demonstrates a consumer integration, **not** a funded subscription nor a successfully fulfilled VRF request on every deployment.

## Draw functions and state gates

| Capability | Polygon / Arbitrum / Base / Optimism / Avalanche | BNB |
|---|---|---|
| Normal external draw initiator | **UNVERIFIED exact external signature/access rule.** Verified source proves an internal coordinator request path, but the published audited artifact does not establish the public entry-point selector. | UNVERIFIED |
| VRF request | VERIFIED internal `s_vrfCoordinator.requestRandomWords` path; request event `SorteioSolicitado(uint256 requestId)` | UNVERIFIED |
| VRF fulfillment | VERIFIED `fulfillRandomWords` consumer callback path | UNVERIFIED |
| Manual contingency | VERIFIED source function `simularSorteioManual(seed)` routes result processing with `requestId = 0` | UNVERIFIED |
| Access control, pause, timing/cooldown, bet/pool/round gates | UNVERIFIED from the presently reproducible write ABI/source excerpt | UNVERIFIED |
| Timestamp/block/next-draw public getter | No getter in the audited production ABI | No getter in the audited production ABI |

This is an important operational result: a source reference to VRF does not prove that an Automation registry can call a draw function. Automation cannot bypass `onlyOwner`, roles, a pause flag, or any other `msg.sender` gate.

## Clock and next draw

No direct schedule, deadline, last-draw, or next-draw getter is in the currently audited production ABI. The existing live UI must therefore continue to say **“Schedule not exposed on-chain.”**

Even if source uses `block.timestamp` internally, it does not self-execute. A transaction must invoke the verified normal draw-request entry point after its conditions are true. Until the exact externally callable selector and all gate conditions are independently reproduced per deployment, no truthful formula or countdown can be published.

## Request ID 0: manual contingency

`SorteioRealizado(requestId, maskSorteada)` is the authoritative on-chain result record. For all currently discovered events, `requestId = 0`; verified source evidence identifies this as the `simularSorteioManual(seed)` contingency route, rather than a Chainlink callback. The frontend must label such records:

> **Draw method: Manual Contingency — result recorded on-chain**

It must never label request ID 0 as a Chainlink-verified draw. The public artifacts used here do not establish the caller role, seed validation, delay window, or whether a caller can bias the supplied seed. Those are security-critical **UNVERIFIED** items; the manual route cannot be promoted as a safe automatic fallback until its exact source and runtime authorization are re-audited.

## Can Chainlink Automation work without redeploy?

**Not established for any network.** It can work without a redeploy only if the normal request function is permissionless *and* all timing/pool/state checks are enforced on-chain, or if the existing contract has a verified role/owner setter that authorizes the Automation registry/executor. Neither condition has been proven by the audited public write surface. A wrapper cannot bypass target-contract `msg.sender` access control.

| Network | Direct Automation without redeploy | External keeper | Redeploy required? |
|---|---|---|---|
| Polygon, Arbitrum, Base, Optimism, Avalanche | VERIFICATION PENDING: prove entry point and authorization first | Potentially, only after proving a signer is authorized | Not yet determinable |
| BNB Smart Chain | VERIFICATION PENDING | Not safe to recommend absent source/access evidence | Not yet determinable |

## Safest proposed operating architecture (not implemented)

1. Independently reproduce the verified source and complete write ABI for each deployment; query owner/roles and all state gates read-only.
2. If a permissionless gated request function exists, use a Chainlink Automation upkeep that calls only that function. Otherwise use a dedicated, least-privilege authorized keeper **only if an existing role mechanism permits it**.
3. Keep the owner in multisig/offline custody. Do not place any private key in the frontend, GitHub, Pages, CI variables exposed to builds, or browser JavaScript. A server-side managed signer/HSM or restricted secret manager is an operational choice, not part of this frontend.
4. Keeper controls: per-chain RPC fallback, native-gas alerts, nonce locking, pre-flight `eth_call`, one in-flight request lock keyed by chain+contract, receipt confirmation, reorg-aware confirmations, retries with exponential backoff, and independent monitoring of subscription funding and coordinator fulfillment.
5. A manual contingency may be made available only after a documented delay/incident threshold and explicit operator approval. It must publish method, caller transaction, request ID 0, and incident reason. If that delay is not contract-enforced, it is an operational policy—not a cryptographic guarantee.

## Failure analysis

| Failure | Existing verified protection | Required operational protection |
|---|---|---|
| Keeper/RPC outage, low native gas, revert, wrong chain/contract | UNVERIFIED | health checks, fixed allowlist, fallback RPCs, simulation, alerts |
| Duplicate request/two operators/reorg | UNVERIFIED | distributed lock, nonce control, receipt/finality checks, event reconciliation |
| VRF subscription underfunded/outage/delayed fulfillment | consumer integration VERIFIED; funding/status UNVERIFIED | subscription monitoring, SLA alerts, incident runbook |
| Manual draw while VRF pending | UNVERIFIED | do not permit operationally until contract gates are audited |
| Malicious automation caller | UNVERIFIED | prove permissionless safety or authorize only a least-privilege executor |

## Frontend data model for a later implementation

Derive only these states from evidence: `Manual Contingency` for `requestId == 0`; `VRF Requested` for an observed `SorteioSolicitado(requestId > 0)`; `Completed — VRF` only after that exact nonzero request ID is tied to a fulfillment/result transaction by contract-provided evidence. `Scheduled`, `Ready`, `Automation Delayed`, and countdowns require verified state variables or an off-chain operator telemetry feed and must not be presented as contract facts.

## Required follow-up evidence before enabling automation

- Complete verified write ABI/source and runtime selector evidence for each network, including BNB.
- Read-only owner/role, pause, timing, pool, round, pending-request, and duplicate-request state.
- The exact VRF subscription configuration and a genuine nonzero request-to-fulfillment linkage.
- A documented authorization change, if the normal function is restricted, tested without touching production.

Until then, **no network is approved for unattended draw initiation**, and no redeployment conclusion is justified from the available evidence.

## 2026-09-15 recovered-source follow-up

The five recovered Solidity files were subsequently supplied as audit input (SHA-256 values are recorded in [contract-source-comparison.md](contract-source-comparison.md)). They establish the source-level draw behavior and the absence of a source-level pending-request or ticket-snapshot lock. Polygon additionally has an explorer **exact-source/runtime** verification and its deployed ABI exposes the corresponding selectors. The other four are classified separately according to their reproducible deployment evidence; BNB remains excluded.

