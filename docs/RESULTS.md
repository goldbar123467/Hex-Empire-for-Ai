# Results

## Engine throughput

| Date | Commit | Machine | Workers | Games/s | Agent decisions/s | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-10-02 | upstream `8272cde` | cloud sandbox, 2 vCPU, Node 22.22 | 1 | 3.1 | — | Owner-supplied pre-fork result: original code + DOM stub, 4 bots, 20 games. Not reproduced here; does not clear the current 200-map benchmark failure. |
| 2026-10-02 | `c1767af` | Windows x64, Ryzen 5 7600X, 12 logical CPUs, Node 22.23.2 | 1 | 7.371 | — | Guarded upstream v1.1, 200 maps 0-199, all complete; 135.664 ms/game, 31.98 mean rounds, 317.59 bot move points/game. One warmup game excluded. |

| 2026-10-02 | `cb17f33` | Windows x64, Ryzen 5 7600X, 12 logical CPUs, Node 22.23.2 | 1 | 3.220 | — | Engine, 200 maps 0-199, alternating with guarded Phase 0 reference at 3.329 games/s: 96.75% relative speed. Both: 31.98 rounds, 317.59 move points/game. Command: `node tools/bench.mjs --games 200 --compare`. Earlier 7.371 absolute speed not reproduced; no cause established. A 50-game CPU profile places most samples in existing bot scoring/pathfinding; no rules optimization applied. |

## Policies



| Date | Policy | Commit | Training data | Eval set | Mode | Games | Win % [95% CI] | Delta vs bot [95% CI] | Win % by seat 0/1/2/3 | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
