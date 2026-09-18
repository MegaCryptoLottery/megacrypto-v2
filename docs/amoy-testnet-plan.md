# Polygon Amoy deployment package — preparation only

This package prepares an unsigned, dry-run-only Polygon Amoy deployment. It does **not** authorize a deployment, subscription creation, funding, wallet connection, signing request, or public-chain transaction.

## Network and VRF constants

| Item | Value |
| --- | --- |
| Network / Chain ID | Polygon Amoy / `80002` |
| Native token | POL |
| Public RPC | `https://rpc-amoy.polygon.technology/` |
| Explorer | `https://amoy.polygonscan.com/` |
| VRF v2.5 coordinator | `0x343300b5d84D444B2ADc9116FEF1bED02BE49Cf2` |
| Key hash | `0x816bedba8a50b294e5cbd47842baf240c2385f2eaf719edbd4f250a137a8c899` |
| Testnet LINK | `0x0fd9e8d3af1aaee056eb9e802c3a762a667b1904` |
| Confirmations / random words | `3` / `1` (maximum 500) |
| Callback gas / coordinator maximum | `500,000` / `2,500,000` |
| Payment | VRF v2.5 subscription, native payment `true` |

The callback limit remains `500,000`: the frozen candidate’s local artifact measurement completed a fulfillment transaction in 80,683 gas with this setting, leaving headroom and staying below the coordinator maximum. It is a testnet starting value, not a mainnet estimate. `subscriptionId` is **PENDING** and is not invented.

## Exact frozen constructor

`MegaCryptoLotteryV2ProductionCandidate` constructor order is exact.

| # | Parameter | Solidity type | Purpose | Amoy status |
| ---: | --- | --- | --- | --- |
| 1 | `token` | `address` | ERC-20 payment token | `PENDING_DEPLOY_MOCK_USDT` |
| 2 | `decimals_` | `uint8` | token decimal convention | `6` |
| 3 | `duration` | `uint64` | round duration/cutoff | `PENDING_OPERATIONAL_DECISION`; candidate minimum is one day |
| 4 | `price` | `uint128` | ticket price in token base units | `PENDING_OPERATIONAL_DECISION`; 5 test USDT would be `5_000_000`, but is not selected here |
| 5 | `initial` | `VrfConfig` | VRF request configuration | below; subscription ID pending |
| 6 | `emergency` | `address` | emergency pause/manual-contingency authority | `PENDING_USER_DECISION` |

The constructor calls `VRFConsumerBaseV2Plus(initial.coordinator)`; inherited `ConfirmedOwner` sets `owner()` to the deployment sender. Therefore `OWNER_ADDRESS=PENDING_USER_WALLET` until a wallet-controlled sender is selected; owner is not a separate constructor parameter.

| `VrfConfig` field | Type | Value/status |
| --- | --- | --- |
| `coordinator` | `address` | configured Amoy coordinator above |
| `subscriptionId` | `uint256` | `PENDING` |
| `keyHash` | `bytes32` | configured Amoy key hash above |
| `callbackGasLimit` | `uint32` | `500000` |
| `requestConfirmations` | `uint16` | `3` |
| `numWords` | `uint32` | `1` |
| `payWithNative` | `bool` | `true`, subject to subscription compatibility confirmation |

## Test-only MockUSDT

`contracts-v2/contracts-testnet/MockUSDT.sol` is **TESTNET ONLY**, **NOT PRODUCTION**, and **NOT REAL USDT**. It is an ERC-20 named `Mock USDT`, symbol `USDT`, decimals `6`, with deterministic owner-only minting. It is not imported by or a modification of the frozen candidate.

## Safe package commands

From `contracts-v2`:

```powershell
npm run amoy:prepare   # compile and print unsigned deployment data
npm run amoy:validate  # print dry-run read-only validation requirements
```

The scripts contain no private-key handling and no broadcast implementation. They reject `AMOY_BROADCAST=CONFIRM`. After separate authorization, use a wallet-controlled signer, preferably hardware backed, rather than credentials in files. The later read-only validator checks chain ID, code, token/decimals, owner, emergency authority, `vrfConfig(1)`, round state, and solvency. Runtime hashes will differ after deployment where constructor immutables are embedded; it reports this and validates ABI-visible values instead.

## Future authorized test sequence — do not execute now

1. Wallet/network verification; obtain test POL.
2. Deploy MockUSDT; mint test USDT.
3. Create/fund VRF subscription; deploy lottery; add lottery consumer.
4. Validate configuration; approve exact ticket price; buy ticket; close round.
5. Request real VRF; observe authenticated fulfillment; settle; verify result, `DrawMethod = CHAINLINK_VRF`, and draw evidence.
6. Claim if applicable; open next round; execute multiple rounds.
7. Controlled pause/unpause; controlled manual contingency; final Amoy report.

## Frozen candidate verification

| Artifact | SHA-256 |
| --- | --- |
| Source | `7a0864029420637eaf8635da405ce70ccfbe08f4abf2d5d7f1751b2cb1745e24` |
| ABI | `fb2631608e3aef666dfb2013035678a6aec562581dece30a44ee77b5f8c776f3` |
| Creation | `56b4a1a21d412f24ed7fa50295e08bb42fc3025b20fdcf18475cdddbad0d8a98` |
| Runtime | `ed8eff46cf8fcf290ff95869fea064ef3fec3fb874523b2203e12388ad6373ff` |

Production candidate Solidity remains frozen and unchanged.

