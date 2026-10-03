# Results

## Engine throughput

| Date | Commit | Machine | Workers | Games/s | Agent decisions/s | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-10-02 | upstream `8272cde` | cloud sandbox, 2 vCPU, Node 22.22 | 1 | 3.1 | — | Owner-supplied pre-fork result: original code + DOM stub, 4 bots, 20 games. Not reproduced here; does not clear the current 200-map benchmark failure. |
| 2026-10-02 | `c1767af` | Windows x64, Ryzen 5 7600X, 12 logical CPUs, Node 22.23.2 | 1 | 7.371 | — | Guarded upstream v1.1, 200 maps 0-199, all complete; 135.664 ms/game, 31.98 mean rounds, 317.59 bot move points/game. One warmup game excluded. |

## Policies


| Date | Policy | Commit | Training data | Eval set | Mode | Games | Win % [95% CI] | Delta vs bot [95% CI] | Win % by seat 0/1/2/3 | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
