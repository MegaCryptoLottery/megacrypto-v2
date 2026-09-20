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

The callback limit remains `500,000`: the post-admin local artifact measurement
completed a fulfillment transaction in 63,330 gas with this setting, leaving
headroom and staying below the coordinator maximum. It is a testnet starting
value, not a mainnet estimate. `subscriptionId` is **PENDING** and is not
invented.

## Exact post-admin constructor

`MegaCryptoLotteryV2ProductionCandidate` constructor order is exact.

| # | Parameter | Solidity type | Purpose | Amoy status |
| ---: | --- | --- | --- | --- |
| 1 | `token` | `address` | ERC-20 payment token | `PENDING_DEPLOY_MOCK_USDT` |
| 2 | `decimals_` | `uint8` | token decimal convention | `6` |
| 3 | `initialRound` | `FutureRoundConfig` | future-only price, duration, BPS, and operational wallet template | below; wallets are `PENDING_USER_ADDRESS` |
| 4 | `initial` | `VrfConfig` | VRF request configuration | below; subscription ID pending |
| 5 | `emergency` | `address` | emergency pause/manual-contingency authority | `PENDING_USER_ADDRESS` |

The constructor calls `VRFConsumerBaseV2Plus(initial.coordinator)`; inherited `ConfirmedOwner` sets `owner()` to the deployment sender. Therefore `OWNER_ADDRESS=PENDING_USER_WALLET` until a wallet-controlled sender is selected; owner is not a separate constructor parameter.

| `FutureRoundConfig` field | Type | Value/status |
| --- | --- | --- |
| `ticketPrice` | `uint128` | `PENDING_OPERATIONAL_DECISION`; 5 test USDT would be `5_000_000` for MockUSDT's six decimals |
| `roundDuration` | `uint64` | `PENDING_OPERATIONAL_DECISION`; minimum one day |
| `jackpotBps` / `weeklyBps` | `uint16` | default intended `5000` / `3800`; total including fees must be exactly `10000` |
| `maintenanceBps` / `oracleBps` | `uint16` | default intended `600` / `600` |
| `maintenanceWallet` | `address` | `PENDING_USER_ADDRESS` |
| `oracleWallet` | `address` | `PENDING_USER_ADDRESS` |

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

`contracts-v2/contracts-testnet/MockUSDT.sol` is **TESTNET ONLY**, **NOT PRODUCTION**, and **NOT REAL USDT**. It is an ERC-20 named `Mock USDT`, symbol `USDT`, decimals `6`, with deterministic owner-only minting. It is not imported by or a modification of the post-admin candidate.

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

## Candidate hash transition

| Artifact | SHA-256 |
| --- | --- |
| Pre-admin source | `7a0864029420637eaf8635da405ce70ccfbe08f4abf2d5d7f1751b2cb1745e24` |
| Current mask-compatible source | `dcf7b58db6ad8c4d2e0640e85437bd6cab8ea64d6aa24a1469964d06d6f2e564` |
| Current ABI | `0199f62a2caa3712a0ea04fe939a7c6921076f3959b23db942a7352135070fb2` |
| Current creation | `5182efc9d03fc2ce2452fbf22bad398e42a0eb4f64b2ed33d462c033cc5853cf` |
| Current runtime | `9166c142313b2eebc9b0d24cf1361a1505e77206aea6d59a00002490a4a12199` |

The post-admin candidate is a local review artifact. It remains unsigned and
undeployed; the dry-run package has no broadcast code.
