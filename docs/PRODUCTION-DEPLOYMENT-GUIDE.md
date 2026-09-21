# Owner guide: production deployment preparation

This is a preparation guide, not permission to deploy. The repository never
asks for a seed phrase, private key, or wallet secret. Use a wallet you control
(preferably hardware backed) only after independent review.

## What you must supply

For each network profile, fill a local reviewed copy of its JSON file with:

- current official payment-token address, decimals, and label;
- ticket price (use `AUTO_5_UNITS` for five token units after confirming
  decimals) and a duration of at least 86,400 seconds;
- maintenance wallet, oracle/VRF wallet, and emergency authority;
- current official Chainlink VRF v2.5 coordinator, key hash, confirmations,
  callback gas limit, word count, native-payment decision, and your
  subscription ID.

The 50/38/6/6 BPS default is 5,000 jackpot, 3,800 weekly, 600 maintenance,
and 600 oracle. The total must remain exactly 10,000. The maintenance and
oracle wallet may intentionally be the same non-zero address.

## Validate before any signature

From `contracts-v2`, first reproduce the reviewed artifact, then execute a
read-only dry run:

```powershell
npm run compile:production
npm run deploy:verify-artifact
npm run deploy:dry-run -- --config deploy-production/config/polygon.json --rpc https://YOUR_READ_ONLY_RPC
```

Review the output line by line: network/chain ID; payment token/decimals;
price and duration; all BPS values; all three operational authorities; every
VRF field; source/ABI/creation/runtime hashes; and encoded constructor data.
The Polygon profile is the first intended path. Do not continue unless it says
`READY_TO_PREPARE_DEPLOYMENT`. The tool performs no broadcast.

The coordinator is high-impact: it is constructor-bound and cannot be changed
in place. Obtain all VRF infrastructure fields from current official Chainlink
material for the exact network, not from this repository or a past deployment.

## Later, controlled deployment and verification

After separate authorization, use the reviewed calldata and a wallet-controlled
signing flow. Record the network, chain ID, deployed address, transaction hash,
block, deployer/owner, emergency authority, recipient wallets, token/decimals,
economics, and VRF inputs in the relevant pending record. Use the explorer's
verification workflow with the exact compiler settings: Solidity 0.8.28,
optimizer 200, viaIR, Shanghai, Chainlink 1.5.0, and OpenZeppelin 5.6.1.

Confirm on-chain: owner, emergency authority, token/decimals, `vrfConfig(1)`,
round-one economics, and that a ticket forwards the 6% maintenance and 6%
oracle amounts immediately. Then make one controlled test purchase, close and
request a draw, verify request-to-round mapping and draw evidence, settle,
check jackpot/weekly accounting, and claim only an entitled winning ticket.

## VRF and Automation checklist

1. Create or select and fund the appropriate VRF v2.5 subscription.
2. Deploy with the confirmed subscription ID, then add the deployed lottery as
   a consumer where the network requires it.
3. Verify coordinator, key hash, callback gas, confirmations, word count, and
   native-payment mode against the subscription.
4. Test authenticated request/fulfillment and inspect request ID → round ID and
   `drawEvidence`.
5. Separately register/fund Automation only after review. Automation calls the
   existing `checkUpkeep` / `performUpkeep` flow for close, request, bounded
   settlement, and opening the next round. Do not register an upkeep until the
   live operational owner has approved it.
