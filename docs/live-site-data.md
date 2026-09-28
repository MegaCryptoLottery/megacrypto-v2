# Live website data model

The frontend is a read-only dashboard until a user explicitly reviews and
confirms a wallet transaction. No background job creates a signer or sends a
transaction.

## Source of truth and refresh policy

| Website information | Source | Refresh |
| --- | --- | --- |
| Global jackpot / weekly pool | `jackpotReserve()` and `rounds(currentRoundId).weeklyPool` on each network, normalized to canonical USDT | 15 seconds, manual refresh, focus/visibility return |
| Selected ticket price, round ID/state/cutoff, ticket count | `rounds(currentRoundId)` | 15 seconds, selected-network or wallet change, focus/visibility return, confirmed receipt |
| Lifecycle status | Contract round state plus `checkUpkeep("0x")` perform data | Same as selected state; never calculated from a local calendar |
| Countdown | `rounds(currentRoundId).cutoffAt` | Renders once per second; requests a fresh contract read at zero |
| My tickets, claimable balance and claim state | Bounded `ticketAt`, `prizeOf`, `claimed`, `claimable` reads for the connected account | 15 seconds, account/connect changes, focus/visibility return, confirmed receipt |
| Draw history | `RoundSettled` logs after audited deployment blocks only | 60 seconds, focus/visibility return, confirmed receipt |
| Recorded winners | Bounded `PrizeRecorded` event scan after audited deployment blocks | 60 seconds, focus/visibility return, confirmed receipt |

Each network is queried independently with the configured public-RPC fallback
list. An unavailable network is excluded from the aggregate and shown as
unavailable; a partial total is explicitly labeled rather than represented as
all-six-network live data. Successful reads record their block number and
timestamp. Request-generation guards reject late responses, and switching the
selected network clears selected-network data before the new response arrives.

## Event and RPC bounds

Public HTTP providers are polled because websocket support is not dependable
across all configured fallback RPCs. A user's confirmed receipt triggers an
immediate refresh; polling then captures third-party events within the normal
15-second interval. Historical draw scans query `RoundSettled` in 2,000-block
chunks, capped to a recent 50,000-block window. BNB draw-event scanning stays
fail-closed because no audited deployment block is configured.

`scripts/audit-live-site-data.mjs` is a read-only operational snapshot tool.
It has no signer, private key, wallet request, contract write, or transaction
code. It reads the current and previous round, upkeep result, reserves,
solvency, active and future configuration, and VRF configuration for each
production deployment.
