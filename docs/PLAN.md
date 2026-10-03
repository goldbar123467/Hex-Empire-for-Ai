# PLAN — Hex Empire RL

Phases run in order. Each phase lists tasks (one PR each) and acceptance checks. A phase is done
when every box is ticked **and** every acceptance check passes. Do not start the next phase early,
except where a task says it can run in parallel.

Baseline facts were measured on upstream commit `8272cde` (see ENV_SPEC → Baseline measurements).

---

## Phase 0 — Fork, baseline, golden fixtures

Goal: a clean fork with tests, a throughput baseline, and golden fixtures recorded from the
**unmodified** upstream code. Goldens must exist before any refactor.

- [x] **0.1 Fork and tidy.** Import pinned `samuelyuan/HexEmpireAI` into the owner's existing `goldbar123467/Hex-Empire-for-Ai` repository (owner-selected destination, 2026-10-02).
  Record the upstream commit hash in `docs/DECISIONS.md`. Keep `LICENSE` (add the owner's copyright
  line *below* the upstream one). Set `package.json` `license` to `MIT` (upstream says `ISC`, which
  contradicts `LICENSE`). Add `.gitignore` entries: `data/`, `runs/`, `.venv/`, `__pycache__/`,
  `*.parquet`, `*.pt`, `node_modules/`. Add `CLAUDE.md` containing the single line `@AGENTS.md`.
  Copy `AGENTS.md` and these docs in. Create `docs/DECISIONS.md` and `docs/RESULTS.md` (empty templates).
- [x] **0.2 CI.** GitHub Actions workflow running `npm ci && npm test` on Node 22 for every PR.
- [ ] **0.3 Reference harness.** `tools/bench.mjs` runs full 4-bot games headless against the
  *original* `public/game/Map.js` using `test/helpers/domStub.mjs`, mirroring `Game.runTurn` exactly
  (see ENV_SPEC → Reference turn loop). Silence `console.warn` inside the harness. Prints games/s,
  ms per game, mean rounds, bot moves per game. Record numbers in `docs/RESULTS.md` under "Engine throughput".
- [x] **0.4 Canonical snapshot + hash (harness-side).** Implement `snapshot(board)` and
  `stateHash(snapshot)` exactly as specified in ENV_SPEC → Canonical snapshot, as standalone functions
  that read the upstream `board` object.
- [ ] **0.5 Golden fixtures.** `tools/make-golden.mjs` plays 100 bot games with the original code
  (map numbers listed in `test/fixtures/golden/maps.json`: 0–49 and 50 numbers spread across
  1–233279) and writes, per game: map number, the state hash after map setup, after every party turn,
  and the final summary (rounds, winner). Commit as `test/fixtures/golden/v1.json` (aim < 1 MB).
  Add `test/golden.test.mjs` that replays the same games and compares every hash.

Acceptance
- `npm test` passes: 37 upstream tests + golden test.
- Running `make-golden` twice produces byte-identical files.
- Bench numbers recorded with machine description (CPU model, cores, Node version).

---

## Phase 1 — Headless engine (single copy of the rules)

Goal: `engine/` holds all game rules and the built-in bot with no DOM access, and both the browser
game and Node tools use it. Behavior is identical to upstream (golden test).

- [ ] **1.1 Extract modules.** Move rules out of `public/game/Map.js`, `Bot.js`, `Pathfinder.js` into
  `engine/`: `rng.js`, `hexgrid.js`, `mapgen.js`, `rules.js`, `bot.js`, `pathfinder.js`, `snapshot.js`,
  `game.js`, `version.js`, `index.js`. Remove all canvas/Image/DOM calls **but keep every `rand()` call
  in the same order** (map generation consumes rand values for cosmetic images; dropping one changes
  every map — see ENV_SPEC → Map generation). Replace `updateGameLog` DOM writes with an event list the
  caller can read (`game.drainEvents()`).
- [ ] **1.2 Game API.** Implement `createGame()` and the methods in ENV_SPEC → Engine API, including
  the turn flow, external controllers, `human_seat`, legal moves (de-duplicated, sorted), action ids,
  turn limit, and terminal logic.
- [ ] **1.3 Hex grid + action ids.** `engine/hexgrid.js` implements cell index, odd-q ↔ axial, the 18
  offsets, and `encodeAction/decodeAction`. `tools/export-hexgrid.mjs` writes `engine/hexgrid.json`
  (consumed by Python). Tests: round trip for every cell and offset; every upstream neighbour equals an
  axial direction; every legal destination is within axial distance 2.
- [ ] **1.4 Snapshot restore.** `engine.fromSnapshot(mapNumber, snapshot)`. Test: for 50 golden games,
  snapshot at a random party turn, restore into a fresh game, play out with bots, final hash equals golden.
- [ ] **1.5 Browser uses engine.** `server.js` serves `engine/` at `/engine`. `public/game/*` imports
  rules from `/engine/index.js`; `MapRender`, `Replay`, `Statistics`, `UI` keep rendering only.
  Watching a 4-bot game in the browser looks and plays as before.
- [ ] **1.6 Tools.** `tools/play.mjs` (run one game, print result and final hash) and `tools/bench.mjs`
  switched to the engine (keep the original-code mode behind `--legacy` for comparison).

Acceptance
- Golden test passes against `engine/` (all 100 games, every hash).
- **External-path test:** for 20 golden maps, drive seat 0 as `external` but choose, at each decision,
  the move the built-in bot would make (`game.botSuggest()`), with `human_seat = -1`. Hashes equal golden.
  This proves `applyMove`/`endTurn` follow the same turn flow as bots.
- `grep -rn "document\.\|window\.\|Math.random\|Date.now" engine/` returns nothing.
- Engine bench within 10% of the Phase 0 baseline (or faster).

---

## Phase 2 — Human play and decision logging

Goal: the owner can play as one empire against three bots in the browser, and every game produces a
verified log.

- [ ] **2.1 Setup panel.** Map number (or random), seat picker (0–3 with empire names/colors),
  pseudonym field (free text, stored in `localStorage`, default `p01`), bot speed (0–1000 ms per move).
  Starting a game sets controllers with the chosen seat `external` and `human_seat` = that seat.
- [ ] **2.2 Click-to-move.** On the human's decision: highlight armies that can move; clicking one
  highlights its legal destinations (from `game.legalMoves()`); clicking a destination calls
  `applyMove`. Show moves left. "End turn" button (also key `E`) calls `endTurn()`. Clicking anything
  illegal does nothing. **No undo.** Bots then play with the chosen animation delay.
- [ ] **2.3 Logger.** Write the raw JSONL format in DATASET_SPEC → Raw logs: header, one line per
  decision (human and bot), footer. Record `think_ms` for human decisions. On every completed round
  and at game end, `POST /api/log` with the lines so far; `server.js` writes
  `data/raw/human/<YYYY-MM-DD>/<game_id>.jsonl` (atomic write: temp file + rename). Add a
  "Download log" button as fallback. Closing the tab mid-game leaves a log without footer; the
  verifier marks it `abandoned`.
- [ ] **2.4 Verifier.** `tools/verify-log.mjs <file|dir>` replays logs through the engine, checks
  every `state_hash`, the footer, and writes a summary (`ok`, `abandoned`, `failed: <reason>`).
  Failed files are moved to `data/raw/quarantine/` only when `--quarantine` is passed.
- [ ] **2.5 Automated UI test.** Playwright test (headless Chromium) that starts a game, plays the
  human seat by always clicking the first legal move until moves run out, ends turns, finishes a game
  (cap 150 rounds), and verifies the produced log. Chromium is preinstalled in some agent sandboxes;
  do not download browsers if `PLAYWRIGHT_BROWSERS_PATH` is set.
- [ ] **2.6 Owner playtest.** The owner plays 3 full games. Fix usability issues they report.

Acceptance
- Playwright test passes in CI.
- The owner's 3 games verify `ok` with `tools/verify-log.mjs`.
- A log's final hash equals `tools/play.mjs` replaying the same decisions.

---

## Phase 3 — Bot game generation (can run in parallel with Phase 2 after 1.6)

- [ ] **3.1 Generator.** `tools/gen-bot-games.mjs --games N --workers K --seed S --human-seat rotate|none
  --out data/raw/bot/<run>/` using `node:worker_threads` or child processes; output JSONL shards in the
  same raw format (`source: "bot"`). Map numbers are drawn from the **train** split only
  (DATASET_SPEC → Splits) unless `--split` says otherwise. `--human-seat rotate` marks seat
  `game_index % 4` as the human seat while bots still play it ("bot-in-human-seat" teacher data).
- [ ] **3.2 Throughput.** Report games/s for K = 1 and K = number of cores in `docs/RESULTS.md`.

Acceptance
- 10,000 games generated; 200 randomly chosen verify `ok`.
- Generation is reproducible: same `--seed` → identical shard contents.

---

## Phase 4 — Python environment

- [ ] **4.0 Training box setup.** `scripts/setup_vast.sh` for the rented Vast.ai instance
  (TRAINING.md §1): Node 22, Python venv, PyTorch for CUDA ≥ 12.8 with an `sm_120` check, `npm ci`,
  `pip install -e "py[dev]"`, prints CPU quota and recommended worker count. Idempotent.
- [ ] **4.1 Worker.** `tools/env-worker.mjs` implements the NDJSON protocol in ENV_SPEC → Worker
  protocol (many games per worker, batched requests).
- [ ] **4.2 Python package.** `py/pyproject.toml` (package `hexrl`, deps: numpy, torch, pyarrow,
  pyyaml, gymnasium; dev: pytest). Modules: `worker.py` (spawn/manage Node workers), `env.py`
  (single-game Gymnasium-style env), `vec_env.py` (batched over workers), `features.py` (snapshot →
  tensor, TRAINING.md → Features), `actions.py` (loads `engine/hexgrid.json`).
- [ ] **4.3 Tests.** pytest: 1,000 random-policy games complete without errors; every sampled action
  is in the mask; observation shapes/dtypes; the env's action sequence for 20 games, written as a raw
  log, verifies `ok` with `tools/verify-log.mjs`.
- [ ] **4.4 Throughput.** Random-policy agent decisions/s for 1 worker and for one worker per core.

Acceptance
- Tests pass. Throughput recorded. Target on the rented 64-thread box: ≥ 5,000 random-policy agent
  decisions/s with the default worker count. If below target, profile first (TRAINING.md §9) and
  record findings.

---

## Phase 5 — Dataset build (local)

- [ ] **5.1 Builder.** `python -m hexrl.build_dataset` turns raw logs into the Parquet tables in
  DATASET_SPEC (replaying each game through a worker to produce state arrays and verify hashes).
- [ ] **5.2 Validation.** `python -m hexrl.validate_dataset` checks the invariants listed in
  DATASET_SPEC → Validation and prints a summary (games, decisions, by source/split/outcome).
- [ ] **5.3 Eval set.** `tools/make-eval-set.mjs` writes `eval/maps_v1.json`: the first 250 map ids
  of the test split in ascending order. Commit it. Never change it; a new set is `maps_v2.json`.

Acceptance
- Rebuilding from the same raw logs gives identical row content (compare per-table hashes of sorted rows).
- Validation passes on: owner's human games + 10,000 bot games.

---

## Phase 6 — Behavior cloning

- [ ] **6.1 Model + trainer.** `models.py` (HexResNet, TRAINING.md → Model), `bc.py` with masked
  cross-entropy, configs in `py/configs/`.
- [ ] **6.2 Evaluator.** `evaluate.py` implements TRAINING.md → Evaluation (paired, seat-rotated, Wilson
  CIs) and appends to `docs/RESULTS.md`. Evaluate baselines first: `random-legal`, `bot-in-seat`.
- [ ] **6.3 BC on bot-in-human-seat data** (`bc_bot`). Report held-out top-1 accuracy and win rate.
- [ ] **6.4 BC fine-tuned on human games** (`bc_human`, initialized from `bc_bot`). Report the same.

Acceptance
- `bc_bot` held-out top-1 accuracy ≥ 60% (the teacher is deterministic; lower means a feature or
  label bug — investigate before continuing).
- RESULTS.md has rows for random-legal, bot-in-seat, bc_bot, bc_human on `eval/maps_v1.json`.

---

## Phase 7 — PPO

- [ ] **7.1 PPO trainer.** `ppo.py`: masked PPO, vectorized envs, agent seat rotated, three built-in bots
  as opponents, init from best BC checkpoint, KL-to-BC penalty (TRAINING.md §5). Checkpoints and
  metrics sync to the private Hugging Face checkpoint repo at every evaluation (TRAINING.md §8).
- [ ] **7.2 Training run** with periodic evaluation on a 100-map slice of the **validation** split;
  keep the best checkpoint by validation win rate.
- [ ] **7.3 Final evaluation** of the best checkpoint on `eval/maps_v1.json`.

Acceptance
- Final PPO row in RESULTS.md with paired comparison against `bot-in-seat`.
  "Beats the bot" may be claimed only if the paired 95% CI on the win-rate difference is above 0.

---

## Phase 8 — Publish

- [ ] **8.1 README.** Under 200 lines: one-paragraph pitch, GIF of the agent playing, how to play and
  log games, how to train, results table (copied from RESULTS.md with dates), dataset link, credits
  (HexEmpireAI by Samuel Yuan, MIT; original Hex Empire), license.
- [ ] **8.2 Kaggle dataset v1.** Prepare `kaggle/` per DATASET_SPEC → Kaggle packaging. The owner runs
  the upload command.
- [ ] **8.3 Starter notebook.** `kaggle/starter.ipynb`: load tables, plot outcome stats, train a small
  BC model on CPU for a few minutes, report held-out accuracy. Must run top-to-bottom on Kaggle.
- [ ] **8.4 Model release.** `export_onnx.py` exports the best checkpoint and passes the onnxruntime
  check (TRAINING.md §8). Prepare `model.onnx`, `best.pt` and the model card; the owner uploads them to
  the public Hugging Face model repo. Tag `v0.1.0`; the GitHub release notes link the model repo and
  the Kaggle dataset. Model files never go into git.

Acceptance
- A fresh clone following README quickstart reaches "playing in the browser" and "training BC on the
  sample data" without undocumented steps (test in a clean container).

---

## Later (only if the owner asks)

- MCP server exposing `observe`, `legal_moves`, `move`, `end_turn` so LLM agents can play the external
  seat, for LLM-vs-RL comparisons on the same eval set.
- Self-play / league training against past checkpoints instead of only built-in bots.
- Rules v2 that fixes the known quirks (requires new goldens and a new dataset version).
