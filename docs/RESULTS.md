# Results

## Engine throughput

| Date | Commit | Machine | Workers | Games/s | Agent decisions/s | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-10-02 | upstream `8272cde` | cloud sandbox, 2 vCPU, Node 22.22 | 1 | 3.1 | — | Owner-supplied pre-fork result: original code + DOM stub, 4 bots, 20 games. Not reproduced here; does not clear the current 200-map benchmark failure. |

## Policies

| Date | Policy | Commit | Training data | Eval set | Mode | Games | Win % [95% CI] | Delta vs bot [95% CI] | Win % by seat 0/1/2/3 | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
