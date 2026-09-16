# Chainlink six-network readiness

Audit date: 2026-09-16. This is a documentation-only, read-only review. It does not authorize a deployment, subscription, upkeep, workflow, or any transaction.

## Current mechanism decision

The hardened contract keeps its lifecycle entrypoints permissionless and state-checked. Chainlink Automation is an optional liveness helper, not a trust or correctness dependency: late, duplicate, or absent execution must leave the state machine safe and resumable by any caller.

The current official Automation supported-networks page lists all six target mainnets. Accordingly, the candidate mechanism is **Chainlink Automation**, subject to a fresh pre-deployment registry/registrar verification. CRE is **not selected** for this contract lifecycle: current CRE documentation requires deploy access for workflows and its deployment/simulation model is a separate operational system. No CRE network-specific deployment readiness was established here.

| Network | VRF v2.5 official page | Automation decision | CRE decision | Deployment configuration |
|---|---|---|---|---|
| Polygon | Listed | Automation candidate; registry/registrar recheck required | Not selected | REQUIRED_BEFORE_DEPLOYMENT |
| BNB Chain | Listed | Automation candidate; registry/registrar recheck required | Not selected | REQUIRED_BEFORE_DEPLOYMENT |
| Arbitrum One | Listed | Automation candidate; registry/registrar recheck required | Not selected | REQUIRED_BEFORE_DEPLOYMENT |
| Base | Listed | Automation candidate; registry/registrar recheck required | Not selected | REQUIRED_BEFORE_DEPLOYMENT |
| Optimism | Listed | Automation candidate; registry/registrar recheck required | Not selected | REQUIRED_BEFORE_DEPLOYMENT |
| Avalanche | Listed | Automation candidate; registry/registrar recheck required | Not selected | REQUIRED_BEFORE_DEPLOYMENT |

## Required per-network manifest before a deployment decision

Each network needs an independently verified, reviewable manifest containing the deployed USDT address and decimals, VRF coordinator, subscription ID, selected key hash, callback gas limit, confirmations, payment mode, Automation registry/registrar, round duration, and ticket price. This repository intentionally does not populate values that have not been freshly verified for the exact deployment chain and account.

## Primary evidence

- Chainlink [VRF v2.5 supported networks](https://docs.chain.link/vrf/v2-5/supported-networks) lists the six target networks and publishes network-specific coordinator/key-hash parameters.
- Chainlink [Automation supported networks](https://docs.chain.link/chainlink-automation/overview/supported-networks) lists registry/registrar parameters for Polygon, BNB Chain, Arbitrum One, Base, Optimism, and Avalanche.
- Chainlink [CRE documentation](https://docs.chain.link/cre) says workflow deployment requires approval; it is therefore not assumed as an available replacement for the optional permissionless lifecycle calls.

## Gate impact

This is not a manifest and does not close the Chainlink configuration blocker. Exact testnet parameters, subscriptions, funding, registration, and a testnet exercise remain **REQUIRED_BEFORE_DEPLOYMENT** once the production candidate itself has passed its local gate.

