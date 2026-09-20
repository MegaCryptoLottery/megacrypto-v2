# Ticket-mask compatibility record

## Canonical convention

MegaCrypto lottery number `n` maps to bit `n`, for the inclusive range
`1..25`. Bit `0` is reserved and never represents a lottery number. A valid
ticket has exactly fifteen distinct set bits in `1..25`.

## Evidence

- `docs/draw-history-vrf-audit.md` records the verified legacy source form
  `maskSorteada |= 1 << num` and its bits `1..25` interpretation.
- `src/web3/player.ts` decodes `mask & (1n << number)` for numbers `1..25`.
- `src/web3/player.test.ts` verifies masks containing bits `1`, `5`, and `25`,
  plus a real Polygon draw mask.

## Candidate implementation

`MegaCryptoLotteryV2ProductionCandidate` now generates winning numbers with
`1 + (hash % 25)` and validates that bit `0` and every bit above `25` are
clear. The hardened local reference contract and all test-side mask helpers
use the identical convention.

## Local compatibility coverage

`contracts-v2/test/production-candidate.mask-compatibility.test.mjs` verifies:

- exact encoding of numbers `1..15`;
- valid ticket acceptance including number `25`;
- rejection of bit `0`, out-of-range bit `26`, and non-fifteen-bit masks;
- fifteen-bit winning masks restricted to bits `1..25`;
- on-chain score `15` for an exact winning ticket and score `14` for an
  intersection retaining numbers `1` and `25`;
- tied exact winners with preserved jackpot and weekly-pool accounting.

The frontend has no V2 contract-mask encoder because the deployed legacy buy
function accepts `uint8[]`; its authoritative decoder already uses this same
canonical convention.
