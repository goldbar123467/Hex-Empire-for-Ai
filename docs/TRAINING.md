# TRAINING — hardware, features, models, BC, PPO, evaluation, artifacts

Python package `hexrl` (PyTorch). The engine stays in Node; Python talks to it through the worker
protocol (ENV_SPEC §8). Simulation runs on CPU cores; the GPU only runs the network.

---

## 1. Where things run

| Machine | Used for |
| --- | --- |
| Owner's PC | Human play in the browser (logs land in `data/raw/human/`), quick local tests |
| Rented Vast.ai instance | Bot data generation, dataset builds, BC, PPO, evaluation |

Rented instance (as listed by Vast.ai): 1× RTX 5060 Ti 16 GB (max CUDA 13.0), AMD EPYC 7B13 with
**64 of 128 threads allocated**, 258 GB RAM, 500 GB NVMe, PCIe 4.0 ×8, **no persistent volume**.

Setup notes for that box:

- **PyTorch:** the RTX 5060 Ti is a Blackwell GPU (`sm_120`). Install a PyTorch build for CUDA 12.8 or
  newer. Check before training: `torch.cuda.is_available()`, `'sm_120' in torch.cuda.get_arch_list()`,
  and a small matmul on `cuda`. Wrong builds fail with "no kernel image is available".
- **Worker count:** read the container CPU quota, not `nproc` / `os.cpus()` (they may report all 128
  host threads). Use `/sys/fs/cgroup/cpu.max` (`quota period` → quota / period threads; `max` means no
  limit). Default workers = quota − 4, leaving room for the trainer process. Allow `--workers` override.
- **Node 22 + Python 3.11+** installed by `scripts/setup_vast.sh` (idempotent; the owner runs it once
  per new instance).
- **Persistence:** the disk disappears when the instance is destroyed. Training pushes checkpoints and
  metrics to the private Hugging Face repo (§8) at every evaluation. Before destroying the instance,
  confirm the latest run is on Hugging Face and copy `data/processed/` off the box (rsync to the owner's
  PC, or a private HF dataset repo if the owner sets one up).
- Raw human logs are created on the owner's PC; copy them to the box with `rsync` before building.

## 2. Features (`features.py`, `FEATURES_VERSION = 1`)

Input: snapshot + `mapInfo` + acting seat `s`. Output: float32 tensor `[37, 20, 20]` on the axial grid
(ENV_SPEC §4). Parties are **seat-relative**: `rel(p) = (p − s) mod 4`, so channel "self" is always the
acting seat. Off-board cells are 0 in every channel except where noted.

| Channels | Content |
| --- | --- |
| 0 | on-board (1 for the 220 real cells) |
| 1–2 | land, water |
| 3–4 | town (non-capital), port |
| 5–8 | original capital of rel party 0–3 |
| 9–13 | owner rel 0–3, unowned land |
| 14–17 | army of rel party 0–3 (presence) |
| 18–19 | army count / 99, army morale / 99 |
| 20 | army moved this turn |
| 21 | own army that can still move now |
| 22–25 | distance to capital of rel party 0–3, / 30, clipped to 1 |
| 26–27 | broadcast: moves_left / 5, round / 150 |
| 28–31 | broadcast: party morale of rel 0–3, / 99 |
| 32–35 | broadcast: party status of rel 0–3, min(status, 4) / 4 |
| 36 | broadcast: duel flag |

The same function is used for dataset rows (BC) and live env steps (PPO). A unit test builds features
from a dataset row and from the env at the same state and asserts equality.

## 3. Model (`models.py`)

**HexResNet** (~0.5 M parameters):

- Stem: 3×3 conv 37 → 64, BatchNorm, ReLU. Trunk: 6 residual blocks (two 3×3 convs, 64 channels).
- Policy head: 1×1 conv 64 → 18 gives one logit per (cell, offset `k`). Gather the 220 on-board
  cells in cell-index order → 3,960 logits (`action = cell × 18 + k`). PASS logit from an MLP on the
  masked mean-pooled trunk features. Total 3,961.
- Value head: masked mean pool → Linear 64 → 64 → ReLU → Linear → tanh (value in [−1, 1]).
- Masking: set illegal logits to −1e9 (finite, not −inf) before softmax / log-softmax. PASS is always
  legal, so the mask is never empty.

A plain 3×3 conv on the axial grid covers the 6 hex neighbours plus 2 non-neighbour corners; that is
fine. Do not add flips or rotations as augmentation unless the hex math is re-derived and tested.

## 4. Behavior cloning (`bc.py`)

| Config | Data | Init |
| --- | --- | --- |
| `bc_bot` | decisions of the human seat in bot-in-human-seat games (`source = bot`, `party = human_seat`, no no-ops) | random |
| `bc_human` | human decisions (`controller = human`) mixed 1:1 per batch with `bc_bot` data | `bc_bot` |

- Loss: masked cross-entropy on `action` + 0.5 × MSE of the value head on the seat's final outcome
  (+1 win, −1 loss, 0 limit). Training the value head here gives PPO a warm start.
- AdamW, lr 1e-3 (`bc_bot`) / 3e-4 (`bc_human`), weight decay 1e-4, cosine decay, batch 1,024,
  bf16 autocast on CUDA. Early stopping on `val` top-1 accuracy (patience 3 epochs).
- Metrics on `val` and `test` games: top-1, top-3, PASS precision/recall (human data only — the bot
  never passes), accuracy by game phase (rounds 0–9, 10–29, 30+).
- Report the human-only `val`/`test` sizes next to every human metric; with few games, numbers are noisy.

## 5. PPO (`ppo.py`)

- **Environment:** one decision per step. Agent seat uniform over 0–3 at each reset;
  `human_seat = agent seat` (same setting as human data, quirk Q6); the other three seats are built-in
  bots; maps from the `train` split; `max_rounds = 150`.
- **Rewards:** terminal +1 win, −1 eliminated, 0 turn limit. Optional potential-based shaping
  `c × (γ·φ(s′) − φ(s))` with `φ = (towns + ports held by the agent) / (towns + ports on the map)`.
  Default `c = 0.5`; always run a `c = 0` control before trusting a shaped result.
- **Batching:** workers × slots envs (e.g. 60 × 16 = 960). Policy inference for all envs runs as one
  batch on the GPU in the trainer process; workers only simulate.
- **Defaults:** rollout 64 steps per env, 4 epochs, minibatch 8,192, clip 0.2, γ 0.995 (per decision),
  GAE λ 0.95, entropy 0.01 → 0.003 linear, value coef 0.5, lr 3e-4 linear decay, grad-norm clip 0.5,
  per-minibatch advantage normalization.
- **Init and regularization:** load the best BC checkpoint (policy + value). Add `β × KL(π ‖ π_BC)` on
  the masked distributions, β = 0.1 decaying linearly to 0 over the first 25% of updates. Log KL to BC.
- **Budget:** first run 50 M agent decisions. Evaluate every ~5 M on a 100-map slice of `val`
  (× 4 seats = 400 games, greedy). Keep `best.pt` by validation win rate and `last.pt`.
- Log to `runs/<run>/metrics.jsonl`: decisions/s, episode return, win/loss/limit rates, episode length,
  entropy, approx-KL, clip fraction, KL to BC, value loss, explained variance.

## 6. Evaluation (`evaluate.py`)

- **Set:** `eval/maps_v1.json` (250 `test` maps) × 4 seats = **1,000 games per policy**.
  `human_seat = evaluated seat`, other seats are bots, `max_rounds = 150`.
- **Policies:** `random-legal` (uniform over legal moves; PASS only when it is the only option),
  `bot-in-seat` (built-in bot plays the seat), `bc_bot`, `bc_human`, PPO checkpoints.
  Main mode greedy (argmax); also report sampled (temperature 1.0, seed 0).
- **Metrics:** win rate with Wilson 95% CI; loss and limit rates; per-seat win rate; mean rounds survived;
  mean towns + ports held at the end.
- **Paired comparison vs `bot-in-seat`:** for each (map, seat) the difference
  `d = win_policy − win_bot ∈ {−1, 0, 1}`; report the mean and a 95% bootstrap CI that resamples
  **maps** (each with its 4 seats), 10,000 resamples, seed 0. "Beats the bot" requires the CI's lower
  bound > 0.
- Same policy, mode and seed → identical results (test this). Save per-game outcomes to
  `runs/<run>/eval/<policy>-<eval_set>.parquet` and optionally raw logs (`source = agent`) for replays/GIFs.

## 7. Reporting (`docs/RESULTS.md`)

Two tables only.

**Engine throughput:** date | commit | machine | workers | games/s | agent decisions/s | notes.

**Policies:** date | policy | commit | training data | eval set | mode | games | win % [95% CI] |
Δ vs bot-in-seat [95% CI] | win % by seat 0/1/2/3 | notes. One row per evaluation, appended by
`evaluate.py --report`. Never edit old rows; add a corrected row and say why in notes.

## 8. Artifacts on Hugging Face

- **Repos** (set in `py/configs/hf.yaml`): `HF_CHECKPOINT_REPO = <hf-user>/hexempire-rl-checkpoints`
  (**private**, created by code with `exist_ok=True`) and `HF_MODEL_REPO = <hf-user>/hexempire-rl-agent`
  (public release; the owner creates it or flips it public).
- **Auth:** `HF_TOKEN` environment variable on the box (prefer a fine-grained token with write access to
  these repos only). Never print it, write it to configs or logs, or commit it.
- **During training:** at every evaluation and at the end, upload `config.json`, `metrics.jsonl`,
  `best.pt`, `last.pt` and eval results to `runs/<run>/` in the checkpoint repo using
  `huggingface_hub.HfApi().upload_folder(...)`. Upload failures retry with backoff and log a warning;
  they never stop training.
- **ONNX export** (`export_onnx.py`): inputs `features [B, 37, 20, 20]` and `legal_mask [B, 3961]`;
  outputs masked `logits [B, 3961]` and `value [B]`; dynamic batch; opset ≥ 17. Verify with
  onnxruntime on 1,000 dataset states: max |logit difference| < 1e-4 on legal actions and identical
  argmax. Store `rules_version`, `features_version`, `schema_version` and the SHA-256 of `hexgrid.json`
  in the ONNX `metadata_props`.
- **Release:** agents prepare `model.onnx`, `best.pt` and a model card (what it is, evaluation table with
  CIs and eval set, rules/features versions, Python usage example with onnxruntime, limitations,
  license MIT, credits). The owner uploads to the public repo and links it from the README and the
  GitHub release.

## 9. Performance

- Expect the CPU simulation to be the bottleneck, not the GPU. Profile before optimizing:
  `node --cpu-prof tools/env-worker.mjs …` for workers, `py-spy record` for the trainer.
- Rough estimate from the sandbox benchmark (ENV_SPEC §9), to be replaced by measurements: a few hundred
  agent decisions/s per worker (each agent decision also runs ~3 bot moves), so roughly 10,000+/s on
  ~60 workers if the Python side keeps up. At that rate 50 M decisions take about 1.5 hours.
  The listed instance price is $0.065/hour.
- Typical fixes in order: more game slots per worker (fewer, larger messages), `orjson`, cache
  `mapInfo`/AI helpers per `map_id`, engine hot paths (ENV_SPEC §9), a binary frame mode.
  A rewrite of the engine is out of scope (AGENTS.md).

## 10. Reproducibility

Every run directory has `config.json` (all hyperparameters, seeds, dataset version, `FEATURES_VERSION`,
`RULES_VERSION`, git commit, worker count, machine), `metrics.jsonl`, checkpoints, and eval outputs.
Seeds: Python `random`, NumPy, Torch, and env map/seat sampling all derive from the run seed.
