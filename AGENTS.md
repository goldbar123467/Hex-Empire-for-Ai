# AGENTS.md — Hex Empire RL

Instructions for any coding agent (Codex, Claude Code, Cursor, etc.) working in this repository.
Read this file fully before doing anything. Then read the docs in this order:

1. `docs/PLAN.md` — the phases, tasks and acceptance checks. **Work only on the current phase.**
2. `docs/ENV_SPEC.md` — game rules, engine API, hex math, action/observation encoding, worker protocol.
3. `docs/DATASET_SPEC.md` — log format, dataset tables, splits, Kaggle packaging.
4. `docs/TRAINING.md` — features, models, behavior cloning, PPO, evaluation protocol.

## What this project is

A fork of [samuelyuan/HexEmpireAI](https://github.com/samuelyuan/HexEmpireAI) (MIT), a JavaScript
remake of the Flash game Hex Empire, turned into:

1. a **headless, deterministic game engine** that runs in Node and in the browser from one copy of the rules,
2. a **human-play mode that logs every decision** so the owner can record games,
3. a **Python RL environment** (Node worker processes + PyTorch) to train agents,
4. a **public dataset** of human and bot games on Kaggle, and
5. a **trained agent** with honest, reproducible results.

Owner: Clark Kitchen (GitHub `goldbar123467`, Kaggle `clarkkitchen`, Hugging Face for model storage).

Repository: `https://github.com/goldbar123467/Hex-Empire-for-Ai.git`, selected by the owner on
2026-10-02. Always use this as `origin`; retain `samuelyuan/HexEmpireAI` as read-only `upstream`.
Make commits at tested task milestones. Use the owner's verified WSL GitHub identity for this repo.

Where things run: human play happens in the browser on the owner's PC. Data generation and training
run on a rented Vast.ai instance (64 CPU threads, RTX 5060 Ti 16 GB, **no persistent disk**) — see
`docs/TRAINING.md` §1. Anything not synced off that box is lost when the instance is destroyed.

## Golden rules

1. **One source of truth for the rules: the JavaScript engine in `engine/`.** Do not port the rules to
   Python, C++, CUDA, Rust or anything else. Python talks to the engine through the worker protocol.
   A rewrite is out of scope unless the owner approves it after profiling shows the engine is the
   training bottleneck (see `docs/TRAINING.md` → Performance).
2. **Never change game behavior silently.** Every refactor of rules code must keep the golden parity
   test passing (`test/golden.test.mjs`, see PLAN Phase 0). If a rules change is intended, bump
   `RULES_VERSION` in `engine/version.js`, regenerate goldens in the same PR, and record why in
   `docs/DECISIONS.md`.
3. **Determinism is a feature.** No `Math.random()`, `Date.now()` or iteration over unordered data inside
   `engine/`. Map generation uses the seeded LCG only. Randomness for sampling policies lives in Python
   with explicit seeds.
4. **Logs must be replayable.** Every logged game must replay through the engine to the same state hash
   at every decision. A game that fails verification is quarantined, never "fixed by hand".
5. **Results need the evaluation protocol.** Do not claim an agent "learned", "beats the bot", or "works"
   without running `docs/TRAINING.md` → Evaluation and adding a row to `docs/RESULTS.md`.
   Training-set accuracy or loss curves are not results.
6. **Keep the repo readable for humans.** See "Documentation limits" below.
7. **Keep upstream credit.** Never remove the upstream MIT copyright notice in `LICENSE`.

## Repository layout (target)

```
hexempire-rl/
  AGENTS.md  CLAUDE.md  README.md  LICENSE  package.json  server.js
  engine/            # headless rules: ES modules, no DOM, no Node-only APIs (runs in browser + Node)
  public/            # browser game: rendering, replay, stats, human-play UI (imports /engine)
  tools/             # Node CLIs: bench, golden, play, gen-bot-games, verify-log, env-worker
  test/              # Node tests (node --test), incl. golden fixtures in test/fixtures/
  py/hexrl/          # Python package: worker client, env, features, dataset, models, bc, ppo, evaluate
  py/tests/          # pytest
  eval/              # committed evaluation map lists (small JSON)
  scripts/           # machine setup (setup_vast.sh)
  kaggle/            # dataset card, dataset-metadata.json, starter notebook
  docs/              # PLAN, ENV_SPEC, DATASET_SPEC, TRAINING, DECISIONS, RESULTS
  data/   runs/      # gitignored: raw logs, built datasets, checkpoints, eval outputs
```

## Commands (keep this section current)

```bash
npm ci && npm test                               # Node tests, incl. golden parity
node tools/bench.mjs --games 200                 # engine throughput
node tools/play.mjs --map 1234 --controllers bot,bot,bot,bot
node server.js                                   # browser game + human play at http://localhost:3000
node tools/verify-log.mjs data/raw/human/        # replay-verify logs
python -m venv .venv && . .venv/bin/activate && pip install -e "py[dev]"
pytest py/tests
python -m hexrl.build_dataset --raw data/raw --out data/processed
python -m hexrl.bc --config py/configs/bc_bot.yaml
python -m hexrl.ppo --config py/configs/ppo.yaml
python -m hexrl.evaluate --policy runs/<run>/best.pt --eval-set eval/maps_v1.json --report
python -m hexrl.export_onnx --checkpoint runs/<run>/best.pt --out runs/<run>/model.onnx
bash scripts/setup_vast.sh                       # once per new rented instance
```

Use Node 22 LTS and Python 3.11+. Express is the only runtime npm dependency; do not add a bundler
or framework to the browser game.

## How to work

- **One task at a time, one branch per task, one PR per task.** Branch names: `phase<N>/<short-task>`.
  Never push to `main` directly.
- Before your first commit, check `git config user.name` and `git config user.email`. If either is
  empty or a placeholder like `YOUR NAME`, stop and ask the owner to set them.
- Each PR must: pass `npm test` (and `pytest` once Python exists), include tests for new behavior,
  update the Commands section above if commands changed, and tick the matching checkbox in `docs/PLAN.md`.
- Commit messages: imperative, specific, under 72 characters for the subject
  (`Add canonical snapshot and FNV-1a state hash`).
- Measure before optimizing. Performance changes include before/after numbers from `tools/bench.mjs`
  in the PR description.
- Long runs (data generation, training) write to `runs/<YYYYMMDD>-<name>/` with a `config.json`,
  the git commit, and logs. Never commit run outputs.

## When to stop and ask the owner

Stop, write the question under "Open questions" in `docs/DECISIONS.md`, and end your turn when:

- a task needs a game-rule change, a dataset schema change after a Kaggle version was published,
  or deleting any file under `data/`;
- the golden parity test fails and you cannot find the cause within two attempts;
- an acceptance check in PLAN.md fails twice after reasonable fixes;
- anything would upload, publish or push outside this repo (Kaggle, public Hugging Face repos, GitHub
  releases, package registries). Prepare the files and the exact command; the owner runs it.
  **One exception:** training code may upload run artifacts to the owner's *private* Hugging Face
  checkpoint repo (`HF_CHECKPOINT_REPO`, TRAINING.md §8) when `HF_TOKEN` is set. Never change a repo's
  visibility.

## Secrets

API keys (`HF_TOKEN`, Kaggle credentials) live only in environment variables or the tools' own
credential files on the machine. Never print them, write them into configs, logs, notebooks or docs,
or commit them. If you find a secret in the repo or in output, stop and tell the owner.

Do not work around a failing check by weakening the test, loosening a threshold, or excluding cases.

## Documentation limits

The previous project of this owner became hard to read because agents generated large numbers of
contracts, evidence files, handoff prompts and milestone reports. Do not repeat that.

- Allowed docs: `README.md`, `AGENTS.md`, `CLAUDE.md`, and in `docs/`: `PLAN.md`, `ENV_SPEC.md`,
  `DATASET_SPEC.md`, `TRAINING.md`, `DECISIONS.md`, `RESULTS.md`. Plus `kaggle/README.md` (data card).
  Create other docs only if the owner asks.
- `README.md` stays under 200 lines and describes what works today, not history.
- `docs/DECISIONS.md`: one dated bullet per decision (what, why, who approved), plus an
  "Open questions" list. No essays.
- `docs/RESULTS.md`: one table row per evaluated policy (see TRAINING.md → Reporting).
- No handoff files, continuation prompts, "evidence" JSON, status reports, or AI-generated
  illustrations in the repo. Your PR description is the handoff.
- Do not put agent prompts or chat transcripts in the repo.

## Out of scope (unless the owner asks)

- Rewriting the engine in another language, writing CUDA kernels, or GPU simulation.
- Changing upstream game rules or bot behavior (including the known quirks in ENV_SPEC → Known quirks).
- New game modes, maps sizes, or player counts.
- Online multiplayer, accounts, or any server beyond localhost.
- Collecting personal data from players beyond a self-chosen pseudonym.
