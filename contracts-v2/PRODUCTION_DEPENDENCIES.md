# Production dependency pins (not yet imported)

The local reference deliberately compiles without production third-party imports so its mock-only test harness remains isolated. Before any testnet deployment, replace the local compatibility/utility implementations with reviewed, exact official package imports and regenerate the lockfile in a clean supported environment.

Pinned versions selected from the npm registry on 2026-09-16:

```text
@chainlink/contracts@1.5.0
@openzeppelin/contracts@5.6.1
```

Required production imports include Chainlink's VRF v2.5 consumer/client/coordinator and Automation interfaces, plus OpenZeppelin `SafeERC20`, `ReentrancyGuard`, and `Ownable2Step`. Do not treat this local reference or this document as a substitute for compiling and auditing the final official-import source.

