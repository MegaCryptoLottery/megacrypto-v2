# Weekly cutoff calendar

`weeklyCutoffOffset` is supplied to the constructor and is the UTC second within a Unix week (`timestamp % 7 days`) at which a round closes. It must be less than seven days and is set before Round 1 opens. The contract never applies US daylight-saving rules. For example, Sunday 20:00 New York is Monday 00:00 UTC while New York is UTC-4, so use `345600`; when New York is UTC-5, use `349200` (Monday 01:00 UTC).

The owner calls `proposeWeeklyCutoff(offset)` and, after `CONFIG_DELAY`, `activateWeeklyCutoff()`. Offsets must be less than seven days. Activation changes only the schedule used by a later `_open`; it never changes the active round's stored `cutoffAt`.

Each new round uses the first configured weekly instant strictly after its actual opening timestamp. Consequently, delayed closure, VRF fulfillment, settlement, or opening cannot make later rounds drift by a week length from the configured schedule. An opening after a scheduled instant skips that missed instant and uses the next one.

## Verified hashes

- `MegaCryptoLotteryV2ProductionCandidate.sol` SHA-256: `C7FA57FDC407D406B4325B2417B60CCFCBB4CA9EEFB448BE4F936791F8DA8C6B`
- `artifacts/production-candidate.json` SHA-256: `92BF0CB4CC58C15B0C8A92C2B6C8484C60035FB42E5B8C19B4BE272A3CE2603D`
