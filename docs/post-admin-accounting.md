# Post-admin candidate accounting specification

## Candidate identity and deployment inputs

The common six-network candidate is
`contracts-v2/contracts-production/MegaCryptoLotteryV2ProductionCandidate.sol`,
identified on-chain by `CANDIDATE_VERSION = POST_ADMIN_CONTROLS_V1`.
It is one Solidity implementation for Polygon, BNB Chain, Arbitrum, Base,
Optimism, and Avalanche. Network differences are constructor/deployment
inputs only: immutable payment token and decimals, constructor-bound Chainlink
coordinator, VRF subscription/configuration, and the two operational wallets.

Neither operational wallet is selected by this repository. Deployment manifests
must use `PENDING_USER_ADDRESS` until the owner supplies reviewed addresses.

## Exact per-ticket accounting

For a round snapshot with ticket price `P` and BPS snapshot `(J,W,M,O)`, the
candidate calculates, in the payment token's smallest unit:

```
jackpotShare     = floor(P * J / 10,000)
weeklyShare      = floor(P * W / 10,000)
maintenanceShare = floor(P * M / 10,000)
oracleShare      = floor(P * O / 10,000)
dust             = P - jackpotShare - weeklyShare - maintenanceShare - oracleShare
```

The constructor/default template is exactly `J/W/M/O = 5000/3800/600/600`.
Every future configuration requires its four BPS values to total **exactly
10,000**, or it reverts. There is deliberately no global hard-coded six- or
eighteen-decimal assumption: `P` is passed in the token's native smallest
unit, and token decimals are checked once at construction.

Purchase sequence is atomic:

1. `SafeERC20.safeTransferFrom` receives exactly `P`; an exact candidate
   balance-delta check rejects fee-on-transfer and malformed token behavior.
2. The maintenance and oracle shares are transferred immediately with
   `SafeERC20` to the addresses snapshotted in that round.
3. A second exact balance-delta check requires candidate retention to equal
   `jackpotShare + weeklyShare + dust`.
4. Only then are the ticket, shares, and reserves recorded.

Therefore a false-return token, fee-on-transfer token, failed maintenance
transfer, failed oracle transfer, or reentrant attempt cannot leave a partial
ticket or partial fee accounting state. Dust is retained as
`unallocatedDustReserve`; it never silently disappears.

## Reserves, claims, and migration

Operational fees are not reserves because they leave immediately. The
candidate does **not** retain misleading `maintenanceReserve` or
`oracleReserve` storage.

At any point, protected in-contract accounting is:

```
playerLiabilities
+ jackpotReserve
+ active current-round weeklyPool
+ unallocatedDustReserve
```

`solvency()` compares that protected accounting with actual token balance.
`protectedReserves()` excludes operational fees. `migratableBalance()` can
only be executed through the existing delayed successor-migration lifecycle,
after the active round has completed; it always excludes `playerLiabilities`.
Historical claims stay payable from the old candidate after migration.

Jackpot, weekly, dust, and liabilities are never exposed to an arbitrary owner
withdrawal. Their only non-claim movement is the already-hardened, timelocked
successor migration, which requires a valid receiver handshake and a completed
active round.

## Future-only economics

`proposeFutureRoundConfig` accepts the complete future template: ticket price,
round duration, four BPS values, maintenance wallet, and oracle wallet. It is
owner-only and delayed by `CONFIG_DELAY` (two days). Activation changes only
the future template. `_open` copies every value into the next `Round`, so an
open or historical round cannot be retroactively changed. The active values
are readable through `futureTicketPrice`, `futureRoundDuration`,
`futureAllocationBps`, `maintenanceWallet`, `oracleWallet`, and
`activeRoundConfig`; the pending value and execution time are readable through
`proposedFutureRoundConfig`.

`RoundEconomicsSnapshotted`, `FutureRoundConfigProposed`,
`FutureRoundConfigActivated`, `MaintenanceWalletChanged`,
`OracleWalletChanged`, and `TicketPurchased` provide the audit trail needed to
reconstruct configuration and each ticket's four shares/dust.

## VRF and payment-token constraints

The payment token remains immutable for the life of a deployment. Replacing
USDT/payment token requires a controlled successor migration; there is no
setter. Existing delayed future VRF configuration still permits only
subscription ID, key hash, callback gas limit, confirmations, number of words,
and native-payment choice while requiring the constructor-bound coordinator.
Normal draw logic is Chainlink VRF; manual contingency remains emergency-only
after the unchanged VRF timeout and records its reason/evidence.
