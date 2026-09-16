# Chainlink integration audit — hardened contract workspace

Audit date: 2026-09-16. Scope: local contract design only. No contract was deployed, no subscription was created or funded, no upkeep was registered, and no public-chain request was made.

## Official-documentation verification

Reviewed on 2026-09-16:

- [Create Automation-Compatible Contracts](https://docs.chain.link/chainlink-automation/guides/compatible-contracts)
- [Chainlink Automation supported networks](https://docs.chain.link/chainlink-automation/overview/supported-networks)
- [Chainlink VRF v2.5 overview](https://docs.chain.link/vrf)

The Automation guide says custom-logic Automation contracts implement `AutomationCompatibleInterface` with `checkUpkeep` (off-chain simulation) and `performUpkeep` (on-chain execution). It also warns that Automation v1.x and v2.1 have scheduled sunsets in 2026 and directs builders toward CRE; this makes final deployment-era documentation review mandatory.

## Chosen model

The hardened reference contract implements the familiar `checkUpkeep(bytes)` and `performUpkeep(bytes)` surface, but does **not** trust the executor. Every `performUpkeep` action includes a round ID/action payload and repeats cutoff, state, request, cursor, migration, and completion validation on-chain. The same valid progress functions are permissionless, so duplicate/stale calls safely revert and liveness is not inherently tied to one keeper.

VRF uses a per-round snapshotted coordinator, subscription ID, key hash, callback gas limit, confirmations, word count, and payment mode. The callback accepts only the snapshot coordinator and finds the round only through `requestIdToRoundId`. It performs constant-cost recording; settlement happens in bounded subsequent calls.

## Required before deployment

For **each** of Polygon, BNB Chain, Arbitrum One, Base, Optimism, and Avalanche, independently verify at deployment time:

| Item | Status |
|---|---|
| Current VRF v2.5 coordinator and supported configuration | REQUIRED_BEFORE_DEPLOYMENT |
| Supported VRF subscription/payment model, gas lane/key hash, callback limits | REQUIRED_BEFORE_DEPLOYMENT |
| Current Automation/CRE support and registration/executor model | REQUIRED_BEFORE_DEPLOYMENT |
| Native gas economics and operational funding thresholds | REQUIRED_BEFORE_DEPLOYMENT |
| Chain-specific USDT address and decimals | Use only separately verified chain registry values |
| Explorer source verification and independently audited deployment bytecode | REQUIRED_BEFORE_DEPLOYMENT |

No coordinator, registry, forwarder, subscription, key hash, or Automation address is hardcoded in this workspace. The existing contracts’ historical addresses are not a deployment template.

## Failure levels

1. Governance can timelock-propose a VRF configuration for **future rounds only**.
2. An authorized emergency authority can execute a clearly marked manual contingency only after a nonzero pending request exceeds the contract timeout.
3. A timelocked successor migration exists only after active-round resolution and protects unclaimed player liabilities.

The local test coordinator is a mock, not a Chainlink implementation. This audit is not a substitute for a final Chainlink integration review, subscription funding verification, or an independent security audit.

