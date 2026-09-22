# Weekly cutoff calendar

`weeklyCutoffOffset` is the UTC second within a Unix week (`timestamp % 7 days`) at which a round closes. The contract never applies US daylight-saving rules. For example, Sunday 20:00 New York is Monday 00:00 UTC while New York is UTC-4, so use `345600`; when New York is UTC-5, use `349200` (Monday 01:00 UTC).

The owner calls `proposeWeeklyCutoff(offset)` and, after `CONFIG_DELAY`, `activateWeeklyCutoff()`. Offsets must be less than seven days. Activation changes only the schedule used by a later `_open`; it never changes the active round's stored `cutoffAt`.

Each new round uses the first configured weekly instant strictly after its actual opening timestamp. Consequently, delayed closure, VRF fulfillment, settlement, or opening cannot make later rounds drift by a week length from the configured schedule. An opening after a scheduled instant skips that missed instant and uses the next one.

## Verified hashes

- `MegaCryptoLotteryV2ProductionCandidate.sol` SHA-256: `6D3A338F88D349590DE70909441DC39FBEF60436655F75CCD77743838CEFBD74`
- `artifacts/production-candidate.json` SHA-256: `208E3540E99FA20AA853E7DEA754547864B94A7D474EC190B21EBC656F92C059`
