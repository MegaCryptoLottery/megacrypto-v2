# Multichain production deployment package

This package prepares, validates, and reviews a future wallet-controlled
deployment. It has no private-key input, signer, broadcast, or funding code.
Dry run is the default and always reports zero signatures, broadcasts, and fund
movement.

## Supported profiles

| Profile | Chain ID | Explorer | Status |
| --- | ---: | --- | --- |
| Polygon | 137 | polygonscan.com | pending owner parameters |
| BNB Chain | 56 | bscscan.com | pending owner parameters |
| Arbitrum One | 42161 | arbiscan.io | pending owner parameters |
| Base | 8453 | basescan.org | pending owner parameters |
| Optimism | 10 | optimistic.etherscan.io | pending owner parameters |
| Avalanche C-Chain | 43114 | snowtrace.io | pending owner parameters |

Payment-token and VRF values deliberately remain
`REQUIRES_CURRENT_OFFICIAL_VERIFICATION`. They are not inherited from historic
frontend records. Populate a copied profile only after checking current
official token, Chainlink, and network documentation.

## Safe workflow

From `contracts-v2`:

```powershell
npm run compile:production
npm run deploy:verify-artifact
npm run deploy:dry-run -- --config deploy-production/config/polygon.json --rpc https://YOUR_READ_ONLY_RPC
```

The dry run refuses a wrong chain, missing bytecode, token-decimal mismatch,
invalid economics, invalid wallets/VRF fields, an unreviewed artifact, or an
oversized runtime. It produces constructor calldata only after every critical
check passes. The VRF coordinator is highlighted as constructor-bound and
immutable for that deployment.

No deploy command is intentionally supplied. After separate authorization, a
user should take the reviewed constructor values to a wallet-controlled
deployment process and sign there deliberately.

See [PRODUCTION-DEPLOYMENT-GUIDE.md](../../docs/PRODUCTION-DEPLOYMENT-GUIDE.md).
