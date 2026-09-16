# Hardened V2 production-candidate record

Audit date: 2026-09-16. **Status: not eligible for testnet or production.**

## Official-import integration target

| Field | Value |
|---|---|
| Source path | `contracts-v2/contracts-production/MegaCryptoLotteryV2ProductionCandidate.sol` |
| SHA-256 | `34976d631486608192edadaf6643be26b8689f2ef9379427e7c9b5ea9fe84139` |
| Solidity target | `0.8.28`, optimizer enabled (200 runs), Shanghai EVM target |
| Chainlink recommended pin | `@chainlink/contracts@1.5.0` |
| OpenZeppelin recommended pin | `@openzeppelin/contracts@5.6.1` |
| Official-import compilation | Passed locally on 2026-09-16 using exact npm package tarballs, solc `0.8.28+commit.7893614a.Emscripten.clang`, optimizer 200, Shanghai, via-IR |
| ABI SHA-256 | `11065f8c536172e53211a93ea1474f914066aca821353ac09a39c9f151d8ee41` |
| Bytecode SHA-256 | Not applicable: this deliberately abstract integration target has no deployable bytecode |

This source is an **official-import architecture target**, not the final full lottery implementation. It proves the intended imports and API surface: `VRFConsumerBaseV2Plus`, `VRFV2PlusClient`, `IVRFCoordinatorV2Plus`, `AutomationCompatibleInterface`, `SafeERC20`, and `ReentrancyGuard`.

`VRFConsumerBaseV2Plus` itself inherits Chainlink's `ConfirmedOwner`, which already supplies two-step ownership. It cannot safely be combined with OpenZeppelin `Ownable2Step`: both bases define `owner`, `onlyOwner`, ownership-transfer methods, and an ownership event. The compile failure was reproduced before removing that invalid multiple inheritance. Therefore the final consumer must use the Chainlink base's two-step ownership surface; OpenZeppelin `Ownable2Step` is **not appropriate in the same inheritance tree**.

## Critical architectural constraint

The official `VRFConsumerBaseV2Plus` authenticates callbacks through `rawFulfillRandomWords`. Its `s_vrfCoordinator` can be changed only through the official owner-or-coordinator `setCoordinator` path. Therefore the final production design must:

- snapshot the coordinator/configuration per round;
- accept callbacks only for that snapshotted round/request; and
- use a delayed, audited configuration or successor-migration policy before any coordinator replacement.

It must not treat the official mutable coordinator hook as sufficient on its own: per-round snapshotting and callback/request binding remain mandatory.

## Required before this can become the sole candidate

1. Install the pinned packages in a clean supported environment; compile the exact official imports.
2. Port the complete hardened round/accounting/migration state machine into that official-import source.
3. Generate ABI/bytecode/source hashes from the compiled final source.
4. Run Slither and an independent external audit against the exact compiled source.
5. Run real local integration suites for malicious coordinator/token/successor behavior, many-round liability migration, and target-chain gas/storage scale.
6. Reverify all Chainlink supported-network and deployment parameters per chain at deployment time.

No deployment artifact, ABI, bytecode, or address from this record is authorized for deployment.

