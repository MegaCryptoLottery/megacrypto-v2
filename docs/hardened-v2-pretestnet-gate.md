# Hardened V2 pre-testnet security gate

Audit date: 2026-09-16. Scope: local source and mock testing only. This is not deployment authorization.

## Gate decision

**TESTNET BLOCKED.** There are no unresolved Critical findings in the local reference, but the unresolved High requirements below prevent a safe recommendation for public testnet use.

The official-import candidate record is [hardened-v2-production-candidate.md](hardened-v2-production-candidate.md). Its coordinator-immutability finding means a future coordinator change must use migration unless an official, audited router architecture is adopted.

## Fixed in this gate

1. The local VRF v2.5 request encoding was incorrect: `extraArgs` had been a raw ABI boolean. The local compatibility helper now uses the canonical v2.5 `EXTRA_ARGS_V1_TAG` / `ExtraArgsV1({nativePayment})` encoding.
2. Each round now stores immutable `DrawMethod`: `NONE`, `CHAINLINK_VRF`, or `MANUAL_CONTINGENCY`. A late VRF callback after manual contingency reverts and cannot overwrite the mask/method.
3. `drawEvidence(roundId)` returns persistent method, winning mask, request ID, snapshotted coordinator/config version, request timestamp, and completion timestamp.

## Official dependency review

Current npm registry versions queried on 2026-09-16:

| Package | Recommended pin | Production purpose |
|---|---:|---|
| `@chainlink/contracts` | `1.5.0` | Import `VRFConsumerBaseV2Plus`, `VRFV2PlusClient`, coordinator interface, and Automation interfaces rather than shipping local compatibility interfaces. |
| `@openzeppelin/contracts` | `5.6.1` | Import audited `SafeERC20`, `ReentrancyGuard`, and `Ownable2Step`. |

The package install could not complete in this Windows environment because npm attempted a child-process spawn and received `EPERM`. The exact recommended pins are recorded in [PRODUCTION_DEPENDENCIES.md](../contracts-v2/PRODUCTION_DEPENDENCIES.md), but are not yet imported by the local reference. **Replacing local compatibility code with the exact official imports, compiling it, and independently auditing the final bytecode is REQUIRED_BEFORE_TESTNET.**

Chainlink’s current Automation guide confirms `checkUpkeep(bytes)` / `performUpkeep(bytes)` for custom logic, while also warning of Automation v1.x/v2.1 sunsets and migration toward CRE. Recheck official documentation, current supported networks, coordinator/subscription parameters, and the exact release API immediately before deployment.

## Evidence and late-VRF behavior

The chosen policy is to **revert** a late/duplicate coordinator callback after manual contingency. It is safest because it preserves an immutable settled method/mask and makes no silent state transition. The timeout/manual path is explicitly trust-based and emits only manual-contingency evidence; it never emits the generic VRF fulfillment event.

## Multi-round accounting and migration status

The local conservation equation is:

```text
playerLiabilities + jackpotReserve + activeRound.weeklyPool
  + maintenanceReserve + oracleReserve + unallocatedDustReserve <= tokenBalance
```

Per-ticket percentage dust and equal-winner allocation dust are explicitly tracked. Existing local tests verify solvency over randomized single-round variants, claims, migration gating, and one completed-round migration with an unclaimed historical jackpot liability that remains claimable after migration. A 100-run dynamic multi-round migration-with-outstanding-liabilities suite, malicious successor suite, and comprehensive historical post-migration-claim suite remain incomplete. **These are High test gaps and BLOCK TESTNET.**

## Large-scale and Automation liveness

`MAX_SETTLEMENT_BATCH` is 200. The callback is O(1). Settlement is O(batch), so 1,000/10,000/100,000 tickets require at least 5/50/500 progress calls. Calls are permissionless and revalidate stale action/state/cursor data, so Automation outage/concurrency cannot corrupt state; another caller can resume.

The 1k/10k/100k result is analytical/local architecture evidence, not target-chain benchmark evidence. A dedicated storage harness and chain-specific gas measurements remain REQUIRED_BEFORE_TESTNET.

## Static analysis

Attempted command: `slither --version` on 2026-09-16. Result: unavailable (`slither` not installed). The workspace static-policy script ran, but it is not Slither and is not presented as an equivalent security audit. Install/run Slither, a compiler-supported toolchain, and an independent audit before testnet.

## Finding status

| Severity | Status |
|---|---|
| Critical | None identified in local review |
| High | Official-import compilation/audit; malicious token/coordinator/successor integration tests; dynamic multi-round liability migration; target-chain gas harness — **BLOCKS TESTNET** |
| Medium | Comprehensive cutoff/config/migration state coverage incomplete — **BLOCKS TESTNET** |
| Low | Add detailed per-round manual evidence getter and operational dashboards |
| Informational | Timestamp tolerance and manual emergency entropy remain governance/trust risks |

No testnet/mainnet deployment, wallet signature, public-chain transaction, ownership change, VRF request, Automation/CRE registration, or fund movement occurred.

