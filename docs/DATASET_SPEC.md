# DATASET_SPEC — logs, tables, splits, Kaggle packaging

Pipeline: **raw JSONL logs** (written while playing) → `tools/verify-log.mjs` → **Parquet tables**
(`python -m hexrl.build_dataset`) → **Kaggle dataset** (owner uploads).
Raw logs store decisions and hashes only; full board states are rebuilt by replaying through the engine.

`schema_version = 1`. Any change to fields or meanings bumps it and is recorded in `docs/DECISIONS.md`.

---

## 1. Identifiers

- `game_id`: human games `crypto.randomUUID()`; bot games `bot-<run>-<index>`; agent games
  `agent-<run>-<index>`.
- `map_id = map_number % 233280` (quirk Q3). All splitting and deduplication use `map_id`.
- `cell = x × 11 + y`; action ids per ENV_SPEC §4 (`PASS = 3960`).

## 2. Raw logs (JSONL, one game per file)

Paths: `data/raw/human/<YYYY-MM-DD>/<game_id>.jsonl`, `data/raw/bot/<run>/shard-<NNNN>.jsonl`
(bot shards may hold many games back to back; each game starts with a header line).

**Header** (first line of each game)

```json
{"type": "header", "schema_version": 1, "game_id": "…", "source": "human",
 "rules_version": "v1-upstream-8272cde", "engine_commit": "abc1234",
 "map_number": 1234, "map_id": 1234, "controllers": ["bot", "human", "bot", "bot"],
 "human_seat": 1, "difficulty": 5, "max_rounds": 150,
 "player_id": "p01", "client": "web", "date": "2026-10-03", "hash_mode": "every_decision"}
```

`controllers` values: `"human"`, `"bot"`, `"agent:<policy_name>"`. `player_id` only for human games.
`date` is the UTC date only (no time of day). `engine_commit`: the browser gets it from `GET /api/version`.
Development builds append `-dirty` to the commit when the checkout has local changes; use a clean
commit for owner data collection. Automated browser tests save under `test-results/`, never in the
owner's `data/raw/human/` directory. The local server replay-verifies each saved prefix before an
atomic write and rejects conflicting updates; an older request cannot truncate a newer log.

**Decision** (one line per decision, by any controller, in play order)

```json
{"type": "decision", "i": 17, "round": 3, "party": 1, "controller": "human",
 "moves_left": 2, "state_hash": "9f1c…", "action": 1872, "from": [10, 2], "to": [11, 3],
 "n_legal": 23, "think_ms": 4210}
```

- `state_hash` is the hash **before** the decision. `moves_left` likewise; it equals the snapshot's
  `moves_left` (ENV_SPEC §5) for bots and external seats alike, so BC features match live play.
- PASS: `"action": 3960, "from": null, "to": null`. A bot move point that moved nothing
  (`makeMove` found no move): `"action": null, "noop": true`.
- `think_ms` only for human decisions (time since the decision became available).
- `hash_mode: "party_turn"` (allowed for large bot runs) writes `state_hash` only on the first decision
  of each party turn; other decisions set it to `null`.

**Result** (last line of a finished game)

```json
{"type": "result", "rounds": 31, "winner": 2, "ended_by": "victory",
 "external_outcome": "loss", "final_hash": "…"}
```

`ended_by`: `victory | eliminated | turn_limit`. `external_outcome` for the human/agent seat:
`win | loss | limit`, or `null` in all-bot games. A file without a result line is **abandoned**.

## 3. Verification

`tools/verify-log.mjs` creates the game from the header, then for each decision line: checks the
current state hash (when present), checks the controller matches the engine's pending decision,
applies the logged action for human/agent decisions, or lets the bot move and checks it made the
logged move for bot decisions. At the end it checks the result line and final hash. Outcomes:
`ok`, `abandoned` (valid prefix, no result), `failed: <reason>`. Only `ok` games enter the main
tables; `abandoned` games are kept with `verified = false` and excluded from default splits.

## 4. Splits

By `map_id % 10`: 0–7 → `train`, 8 → `val`, 9 → `test`. Applies to every source.
Bot data generation and PPO training sample maps from `train` only. `eval/maps_v1.json` (PLAN 5.3) is
drawn from `test`. A map appears in exactly one split no matter how many times it is played.

## 5. Tables (Parquet, zstd)

**`maps.parquet`** — one row per `map_id` that appears in `games`.

| Column | Type | Notes |
| --- | --- | --- |
| map_id | int32 | |
| terrain | list<int8>[220] | 0 water, 1 land |
| estate | list<int8>[220] | 0 none, 1 town, 2 port |
| capital | list<int8>[220] | −1 or seat |
| town_name | list<string>[220] | null where no estate |
| dist_to_capital | list<int16>[880] | seat-major: `dist[seat × 220 + cell]` |
| land_count, town_count, port_count | int16 | |

**`games.parquet`** — one row per game.

| Column | Type | Notes |
| --- | --- | --- |
| game_id | string | |
| source | string | human / bot / agent |
| split | string | train / val / test |
| map_number, map_id | int32 | |
| controllers | list<string>[4] | |
| human_seat, external_seat | int8 | −1 if none |
| player_id | string, nullable | pseudonym |
| date | date32 | |
| rules_version, engine_commit | string | |
| rounds | int16 | |
| winner | int8 | −1 if none |
| ended_by | string | victory / eliminated / turn_limit / abandoned |
| external_outcome | string, nullable | win / loss / limit |
| n_decisions, n_external_decisions | int32 | |
| verified | bool | |
| final_hash | string | |

**`decisions.parquet`** — one row per decision; state columns describe the board **before** it.
Published as `decisions_human.parquet` (games with `source = human`) and `decisions_bot.parquet`
(`source = bot`).

| Column | Type | Notes |
| --- | --- | --- |
| game_id | string | |
| i | int32 | decision index in game, from 0 |
| round | int16 | |
| party | int8 | acting seat |
| controller | string | human / bot / agent |
| is_external | bool | acting seat is the game's external seat |
| moves_left | int8 | |
| action | int16 | −1 for bot no-op |
| is_pass | bool | |
| from_cell, to_cell | int16 | −1 for pass / no-op |
| n_legal | int16 | |
| legal_actions | list<int16> | sorted, PASS included |
| think_ms | int32, nullable | human only |
| owner, army_party, army_count, army_morale, army_moved | list<int8>[220] | snapshot arrays |
| party_morale, party_total_count | list<int16>[4] | |
| party_status, wfs_count | list<int8>[4] | |
| wfs_cell | list<int16>[4] | |
| duel | bool | |
| state_hash | string | recomputed during build |

## 6. Validation (`python -m hexrl.validate_dataset`)

- Every `verified` game replays to `final_hash`; recomputed decision hashes match the logs.
- Decision indices are contiguous from 0; `games.n_decisions` equals the row count.
- `action ∈ legal_actions` for every row with `action ≥ 0`.
- For moves, `from_cell` holds an army of `party` with `army_moved = 0` in the row's state.
- `0 ≤ army_morale ≤ army_count ≤ 99` where an army exists; arrays have length 220.
- `split` matches `map_id % 10`; no duplicate `game_id`; every `map_id` in `games` exists in `maps`.
- `player_id` matches `^[A-Za-z0-9_-]{1,32}$` (rejects emails and spaces).
- Prints counts by source, split, outcome, and human decisions per player.

## 7. Size budget and Kaggle v1 contents

Each decision row is ~1.1 KB before compression; a bot game has ~350 decisions.
**v1 target: under 2 GB on disk.**

- All verified human games (the unique part; publish once there are at least 30).
- 5,000 bot-in-human-seat games from `train` maps, seats rotated (`--human-seat rotate`).
- `maps.parquet` for every referenced map.
- The generator command in the data card so users can create more bot data locally.

## 8. Privacy

- Store only a self-chosen pseudonym. No names, emails, IP addresses or times of day.
- If anyone other than the owner contributes games, they agree first and choose their pseudonym.
- The server writes logs only to local disk. Nothing is uploaded automatically.

## 9. Kaggle packaging (`kaggle/`)

```
kaggle/
  README.md               # data card (also pasted into the dataset description)
  dataset/                # files to upload (gitignored except dataset-metadata.json)
    dataset-metadata.json
    maps.parquet  games.parquet  decisions_human.parquet  decisions_bot.parquet
    hexgrid.json          # copy of engine/hexgrid.json
  starter.ipynb
```

- Create the metadata with `kaggle datasets init -p kaggle/dataset`, then fill in: title
  `Hex Empire Games: Human and Bot Play`, id `clarkkitchen/hex-empire-games`, subtitle, description
  (from the data card), keywords, license. Target license **CC BY 4.0**; check the current Kaggle API
  docs for the exact field names and license identifier before filling them in.
- **The owner runs uploads** (agents prepare files and print the command):
  first version `kaggle datasets create -p kaggle/dataset`, later versions
  `kaggle datasets version -p kaggle/dataset -m "<what changed>"`.
- Data card sections: summary; how games were collected (browser human play vs built-in bot);
  files and columns (link this spec at the release tag); encodings (cell index, axial coordinates,
  action ids, `hexgrid.json`); splits; rebuilding states with the engine (repo link + tag); rules
  version and known quirks (ENV_SPEC §2); intended uses (imitation learning, offline RL, analysis);
  limitations (small human sample, mostly one player's style, quirky upstream rules, bots are not
  strong players); license and credits (HexEmpireAI by Samuel Yuan, MIT; the original Flash game
  Hex Empire); changelog.
- Published versions are immutable in meaning: fix mistakes in a new version and note them in the
  changelog.
