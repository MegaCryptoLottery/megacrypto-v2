# Hardened V2 production-candidate record

Audit date: 2026-09-16. **Status: not eligible for testnet or production.**

## Official-import integration target

| Field | Value |
|---|---|
| Source path | `contracts-v2/contracts-production/MegaCryptoLotteryV2ProductionCandidate.sol` |
| SHA-256 | `0b5f9d87b3b16af729db419848d39c4f3cbbff629821c0b439feb897a4b6d98d` |
| Solidity target | `0.8.28`, optimizer enabled (200 runs), Shanghai EVM target |
| Chainlink recommended pin | `@chainlink/contracts@1.5.0` |
| OpenZeppelin recommended pin | `@openzeppelin/contracts@5.6.1` |
| ABI hash | Not generated: official dependencies could not be installed/compiled in this environment |

This source is an **official-import architecture target**, not the final full lottery implementation. It proves the intended inheritance and API surface: `VRFConsumerBaseV2Plus`, `VRFV2PlusClient`, `IVRFCoordinatorV2Plus`, `AutomationCompatibleInterface`, `SafeERC20`, `ReentrancyGuard`, and `Ownable2Step`.

## Critical architectural constraint

The official `VRFConsumerBaseV2Plus` authenticates the coordinator passed to its constructor. That makes coordinator identity immutable for a non-upgradeable consumer. Therefore the final production design must use:

- immutable coordinator per deployment;
- future-round updates only for coordinator-compatible parameters such as subscription/key-hash/callback settings where the official API allows them; and
- controlled successor migration for a coordinator replacement.

It must not claim that a mutable coordinator setting remains compatible with the official base consumer unless the final audited architecture provides an official, separately authenticated router pattern.

## Required before this can become the sole candidate

1. Install the pinned packages in a clean supported environment; compile the exact official imports.
2. Port the complete hardened round/accounting/migration state machine into that official-import source.
3. Generate ABI/bytecode/source hashes from the compiled final source.
4. Run Slither and an independent external audit against the exact compiled source.
5. Run real local integration suites for malicious coordinator/token/successor behavior, many-round liability migration, and target-chain gas/storage scale.
6. Reverify all Chainlink supported-network and deployment parameters per chain at deployment time.

No deployment artifact, ABI, bytecode, or address from this record is authorized for deployment.

