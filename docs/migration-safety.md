# Hardened-contract migration safety

This design is a future escape hatch, not an authorization to move existing funds. Existing MegaCrypto deployments remain untouched.

## Lifecycle

`NORMAL → MIGRATION_PROPOSED → MIGRATION_READY → MIGRATED_CLAIMS_ONLY`

Only the two-step owner can propose a successor. The proposed address must be nonzero, contain code, return the required receiver magic for the same USDT token and chain ID, and then wait at least seven days. The owner may cancel before execution.

Execution requires the current round to be `COMPLETED`; an OPEN, CLOSED, VRF-requested, received, or settling round blocks migration. The old contract transfers only `migratableBalance`, defined as token balance less `playerLiabilities`, to the handshake-validated receiver. It then becomes `MIGRATED_CLAIMS_ONLY`: no new purchases or draw progress can occur, while already earned claim rights remain callable.

## Protected-liability model

`playerLiabilities` increases when a completed round creates the aggregate award and falls only after individual successful claims. `solvency()` reports whether:

```text
playerLiabilities + protectedReserves <= token balance
```

The `migratableBalance()` calculation excludes all recorded player liabilities. This is intentional even if other reserves are permitted to move only after the active round has resolved. The model does not blindly transfer the full balance.

The local reference uses SafeERC20-style low-level wrappers that accept standard boolean-returning and no-return tokens, and applies a reentrancy guard to purchases, claims, callbacks, manual contingency, and migration. A production audit must still assess the chosen real USDT implementation on each chain.

## Residual governance risk

The handshake prevents a mistaken EOA target but cannot make a malicious, governance-approved contract safe. A production plan therefore requires multisig governance, independent successor audits, public timelock monitoring, published migration accounting, tests against the exact token, and a clear player claim notice. Liability transfer into a successor is deliberately **not** implemented; old claims remain in the old contract.

## Required before deployment or migration

- independent audit of accounting, dust, and all successor code;
- chain-specific token behavior and decimals verification;
- full inventory of active rounds, pending VRF, reserves, liabilities, and claimable prizes;
- multisig/timelock operational policy and emergency response;
- independently verified receiver handshake and test migration on local/test environment first.

