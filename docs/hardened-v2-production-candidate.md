# Hardened V2 production-candidate record

Audit date: 2026-09-16. **Status: concrete local candidate; not eligible for testnet or production.**

## Official-import integration target

| Field | Value |
|---|---|
| Source path | `contracts-v2/contracts-production/MegaCryptoLotteryV2ProductionCandidate.sol` |
| SHA-256 | `7a0864029420637eaf8635da405ce70ccfbe08f4abf2d5d7f1751b2cb1745e24` |
| Solidity target | `0.8.28`, optimizer enabled (200 runs), Shanghai EVM target |
| Chainlink recommended pin | `@chainlink/contracts@1.5.0` |
| OpenZeppelin recommended pin | `@openzeppelin/contracts@5.6.1` |
| Official-import compilation | Passed locally on 2026-09-16 using exact npm package tarballs, solc `0.8.28+commit.7893614a.Emscripten.clang`, optimizer 200, Shanghai, via-IR |
| ABI SHA-256 | `fb2631608e3aef666dfb2013035678a6aec562581dece30a44ee77b5f8c776f3` |
| Creation bytecode SHA-256 | `56b4a1a21d412f24ed7fa50295e08bb42fc3025b20fdcf18475cdddbad0d8a98` |
| Runtime bytecode SHA-256 | `ed8eff46cf8fcf290ff95869fea064ef3fec3fb874523b2203e12388ad6373ff` |

This source is a concrete, deployable local candidate using official `VRFConsumerBaseV2Plus`, `VRFV2PlusClient`, `AutomationCompatibleInterface`, `SafeERC20`, and `ReentrancyGuard`. It ports the hardened round lifecycle, accounting reserves, bounded settlement, claim flow, manual-contingency evidence, configuration delay, and claims-preserving migration model.

`VRFConsumerBaseV2Plus` itself inherits Chainlink's `ConfirmedOwner`, which already supplies two-step ownership. It cannot safely be combined with OpenZeppelin `Ownable2Step`: both bases define `owner`, `onlyOwner`, ownership-transfer methods, and an ownership event. The compile failure was reproduced before removing that invalid multiple inheritance. Therefore the final consumer must use the Chainlink base's two-step ownership surface; OpenZeppelin `Ownable2Step` is **not appropriate in the same inheritance tree**.

## Critical architectural constraint

The official `VRFConsumerBaseV2Plus` authenticates callbacks through `rawFulfillRandomWords`. Its `s_vrfCoordinator` can be changed only through the official owner-or-coordinator `setCoordinator` path. Therefore the final production design must:

- snapshot the coordinator/configuration per round;
- accept callbacks only for that snapshotted round/request; and
- use a delayed, audited configuration or successor-migration policy before any coordinator replacement.

It must not treat the official mutable coordinator hook as sufficient on its own: per-round snapshotting and callback/request binding remain mandatory.

## Required before this can become the sole candidate

1. Add a dedicated official-coordinator mock regression suite for this exact bytecode, including malicious token/coordinator/successor cases.
2. Run Slither and an independent external audit against the exact compiled source.
3. Run real local integration suites for malicious coordinator/token/successor behavior, many-round liability migration, and target-chain gas/storage scale.
6. Reverify all Chainlink supported-network and deployment parameters per chain at deployment time.

No deployment artifact, ABI, bytecode, or address from this record is authorized for deployment.

