# Production candidate adversarial gate

## VRF coordinator configuration limitation

`MegaCryptoLotteryV2ProductionCandidate` inherits Chainlink
`VRFConsumerBaseV2Plus`. Its coordinator is fixed by the constructor through
the inherited `s_vrfCoordinator`. Future configuration proposals explicitly
require the same coordinator address, so a foreign coordinator proposal
reverts with `COORDINATOR_SNAPSHOT`.

This is intentional protection, not an in-place coordinator rotation feature.
Future configurations can update only the parameters stored in a new config
version while preserving the constructor-bound coordinator. Pending requests
continue to authenticate through that bound coordinator. Any future Chainlink
coordinator migration requires the controlled successor/migration lifecycle.

Finding `ADV-INFO-001`: informational; coordinator replacement is not
available in-place. Regression coverage is in
`contracts-v2/test/production-candidate.test.mjs`.

## Gate status

The hostile-token, hostile-coordinator, migration-liability, hostile-successor,
reentrancy, and complete pause/emergency suites remain required before this
adversarial gate can pass. No public-chain interaction is part of this gate.

