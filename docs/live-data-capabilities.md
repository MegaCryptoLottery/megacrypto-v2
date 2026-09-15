# Live on-chain data capabilities

V2 reads only functions present in the verified deployed lottery ABI. It does not infer rounds, schedules, VRF configuration, lifetime totals, or historical tickets that the contracts do not expose.

| Capability | Source | Scope / limitation |
| --- | --- | --- |
| Selected-network jackpot | `jackpotAcumulado()` | Current pool on the selected deployment. |
| Selected weekly pool | `poolSemanal()` | Current pool on the selected deployment. |
| Ticket price | `precoBilhete()` | Current contract value. BNB uses its verified 18-decimal value scale; other configured deployments use 6. |
| Current tickets / players | `getApostasCount()` + `apostasDaSemana(index)` | The UI reads the newest 500 current bets at most. Unique-player count is for that bounded current scan, never a lifetime metric. |
| Wallet ticket list | `apostasDaSemana(index)` | Reconstructed only from the bounded current-week getter; older round selections are unavailable through the verified ABI. |
| Claimable prize | `premiosParaSacar(wallet)` | Read-only; this phase does not expose a claim transaction. |
| Winner records | `getHistoricoCount()` + `ultimosGanhadores(index)` | Latest 100 records per network at most. “Recorded prizes” is the sum of the displayed bounded records, not a lifetime total. |
| Draw history | `SorteioRealizado` event | Not displayed until an audited deployment start block is configured. V2 never scans from block 0. |
| VRF verification | Contract configuration / request evidence | Pending: the registry/ABI has no verified coordinator, subscription, callback, or request evidence for any deployment. |
| Next draw | Contract getter | Unavailable: the verified ABI has no schedule/timing getter. |

Manual refresh and post-receipt refresh re-read selected-network data and global aggregates. No aggressive polling is used.
