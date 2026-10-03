# ENV_SPEC — game rules, engine API, encodings, worker protocol

Source of truth for behavior: upstream `samuelyuan/HexEmpireAI` at commit
`8272cde7fce46520cffc3c845ed3f83ff95ead0a` (files `public/game/Map.js`, `Bot.js`, `Pathfinder.js`,
`Game.js`). The rules summary below is for orientation. **When this document and the upstream code
disagree, the code wins** and this document gets corrected.

---

## 1. Game facts

**Board.** 20 columns (`x` 0–19) × 11 rows (`y` 0–10) = 220 hexes, "odd-q" layout: odd columns are
drawn half a hex lower. Each hex is `land` or `water`. Land count varies by map (155–198 in a 40-map
sample). Estates on land: `town`, `port`; capitals are towns with `capital = <party index>`.

**Parties (seats).** Four, always. Capitals are fixed:

| Seat | Name | Color | Capital |
| --- | --- | --- | --- |
| 0 | Redosia | red | (1, 1) |
| 1 | Violetnam | violet | (1, 9) |
| 2 | Bluegaria | blue | (18, 1) |
| 3 | Greenland | green | (18, 9) |

**Round.** `board.turns` counts rounds from 0. In each round parties act in order 0, 1, 2, 3.
The game stops after a round in which `isVictory` is true, or after 150 rounds (upstream
`maxTurnLimit` in `Main.js`).

**Party turn.** Up to `movePoints = min(5, number of the party's armies with moved == false)` moves,
computed **before** the moved flags are reset (quirk Q1). Each move takes one army that has not moved
this turn to a destination from `Pathfinder.getPossibleMoves(field, {excludeSelf: true})`:
neighbours, plus a second step through an empty non-estate land hex (land), or through empty water
(ports and armies at sea). Every destination is within hex distance 2. Moving onto an enemy army
attacks; onto an own army joins (capped at 99 units, overflow stays behind as a new army). After
moves, `unitsSpawn` reinforces held capitals and towns.

**Armies.** `count` 1–99 and `morale` 0–`count`. Power = `count + morale`.
Combat (`Map.attack`): the attacker wins only if its power is strictly greater (ties go to the
defender). Attacker wins: it loses `floor(defPower / attPower × attacker.count)` units. Defender wins: it
loses `floor(attPower / defPower × attacker.count)` units (note: scaled by the *attacker's* count). The
winner keeps at least 1 unit; the loser is destroyed. All armies of the losing party lose
`floor(loser.count / 10)` morale.

**Morale.** Capturing hexes raises morale (capital of a living empire: +30 capturing army, +50 all
armies; former capital +20/+30; town +10/+10; port +5/+5; plain land +1 all armies) and costs the
previous owner (−30 / −10 / −5 for all their armies). Armies that did not move lose 1 morale at the
start of their party's next turn. `updateBoard` floors every army's morale at
`floor(party_total_count / 50)`. Capturing a hex also claims adjacent empty plain land.

**Reinforcement** (`unitsSpawn`, end of the party's own turn). Every capital the party holds gets +5
units; every town it holds (capitals included) gets `5 + floor((plain_land + 5 × ports) / towns)` units.

**Elimination and victory.** A party whose original capital is held by someone else has status 0: its
armies are removed and its land passes to whoever holds its capital. A party wins when it holds all
three other original capitals and their owners have no armies (`checkPartyState`, `isVictory`).

## 2. Known quirks (preserve them; rules v1 = upstream behavior)

| ID | Quirk | Consequence |
| --- | --- | --- |
| Q1 | `getMovePoints` runs before `cleanupTurn`, so the move budget counts armies that did **not** move last turn (plus new armies). | Fewer moves than armies in 42% of party turns (1,449 / 3,436 in 40 bot games). Passing early raises next turn's budget. |
| Q2 | Join overflow creates a new army at the origin with `moved = false`. | That army can move again in the same turn. |
| Q3 | Map numbers repeat with period 233,280 (LCG modulus): map `n` and `n + 233280` are identical. | Use `map_id = map_number % 233280` for splits and dedup. |
| Q4 | `getPossibleMoves` can return the same hex more than once (up to 36 entries for 18 hexes). | Engine de-duplicates for legal moves. Bot code keeps its own list unchanged. |
| Q5 | Bot scoring writes `wait_for_support` and `tmp_prof` onto shared field objects; later armies overwrite earlier armies' values. An army with no destination keeps a stale `move`/`profitability` from a previous turn. | Hidden state not in the snapshot. Keep as is. If the restore test (PLAN 1.4) ever fails because of it, extend the snapshot (v2) rather than changing behavior. |
| Q6 | Setting a human seat changes bot behavior: bots add `difficulty × 2` (= 10) to moves toward the human's capital; `annexLand` calls `updateBoard` mid-move when the human takes or loses capitals. | Human games and agent games must use the same `human_seat` setting (see §6). |
| Q7 | Upstream `Game.runComputerTurn` returns early for non-computer seats **without** `unitsSpawn`; human play was never implemented. | Engine deliberately spawns for external seats too. Goldens are unaffected (all-bot). Record in DECISIONS.md. |
| Q8 | Pact/peace code (`hw_peace`, `hw_pact_signed`) is never activated (`hw_peace` is never set ≥ 0). | Dead code; keep, do not expose. |
| Q9 | Seat advantage: in 40 bot-only games seat 0 won 18, seat 1 won 5, seat 2 won 10, seat 3 won 7. | Always rotate seats in evaluation and report per seat. |
| Q10 | The original bot can rank an army with no destination first, then dereference `bestMove.move.wait_for_support`. Confirmed on map 107, zero-based round 9, seat 0, using the original Game turn methods. | Phase 0's 200-game benchmark fails; a versioned guard awaits owner approval. Do not silently discard the map. |

## 3. Map generation

`new Map(mapNumber)` seeds the LCG `rnd = (rnd × 9301 + 49297) % 233280`. Generation consumes `rand()`
for terrain **and for cosmetic choices** (background tiles, flips, rotations, sea tiles, town images,
town names). When removing rendering, keep every `rand()` call in the same order and discard the
values. Upstream test `test/map-generation-determinism.test.mjs` exists because this broke once.
Generation itself takes ~5 ms. `calcAIHelpers` then computes per-hex path length to each capital (bot
helper, ~51 ms per map — 90% of setup; cache its results per `map_id` in workers).

## 4. Hex grid and action encoding

- **Cell index:** `cell = x × 11 + y` (x-major, matching upstream loops). 0–219.
- **Odd-q → axial:** `q = x`, `r = y − (x − (x & 1)) / 2`. `r` ranges −9…10.
  For CNNs embed into a 20 × 20 grid at `(Q, R) = (q, r + 9)`; 180 cells are off-board padding.
- **Upstream neighbour order** (`Map.findNeighbours`) maps to axial directions; test that every one of
  the 6 is in {(1,0), (1,−1), (0,−1), (−1,0), (−1,1), (0,1)}.
- **Destination offsets:** the 18 axial offsets `(dq, dr)` with `max(|dq|, |dr|, |dq + dr|) ∈ {1, 2}`,
  sorted lexicographically by `(dq, dr)`. Index `k` = position in that list (0–17).
- **Action id:** `action = cell(from) × 18 + k`. `PASS = 3960` ends the party's turn early.
  `NUM_ACTIONS = 3961`.
- `engine/hexgrid.json` (generated): `cells[i] = {x, y, q, r}`, `offsets[k] = {dq, dr}`,
  `num_actions`, `pass_action`. Python reads this file; it never re-derives the math.

## 5. Canonical snapshot and state hash

`snapshot()` returns this object, keys in this order, integers only:

```json
{
  "v": 1,
  "round": 12,
  "party": 2,
  "moves_left": 3,
  "owner":       [220 × int, -1 = none],
  "army_party":  [220 × int, -1 = no army],
  "army_count":  [220 × int],
  "army_morale": [220 × int],
  "army_moved":  [220 × 0|1],
  "party_morale":      [4 × int],
  "party_status":      [4 × int],
  "party_total_count": [4 × int],
  "wfs_cell":  [4 × int, cell index of hw_parties_wait_for_support_field or -1],
  "wfs_count": [4 × int],
  "duel": 0
}
```

`army_*` arrays read `field.army` only (dying armies are not on fields). `moves_left` is the number of
move points the acting party still has in the current party turn, for bots and external seats alike
(the engine tracks the bot loop counter); it is 0 between party turns, so hashes taken after a party
turn (goldens) always have 0. The Phase 0 harness passes it in: `snapshot(board, movesLeft)`. `stateHash = FNV-1a 64-bit` over the UTF-8
bytes of `JSON.stringify(snapshot)`, lowercase 16-hex-digit string (offset basis
`0xcbf29ce484222325`, prime `0x100000001b3`; BigInt or 32-bit-limb implementation, identical in Node and
browsers). Test vectors: `""` → `cbf29ce484222325`, `"a"` → `af63dc4c8601ec8c`,
`"foobar"` → `85944171f73967e8`. Static map data is not in the snapshot; it is `mapInfo()`:
`terrain[220]` (0 water, 1 land), `estate[220]` (0 none, 1 town, 2 port), `capital[220]` (−1 or seat),
`town_name[220]` (string or null), `dist_to_capital[4][220]` (= −`field.profitability[p]`).

## 6. Engine API (`engine/index.js`)

```js
const game = createGame({
  mapNumber: 1234,                                  // int >= 0
  controllers: ['bot', 'external', 'bot', 'bot'],   // per seat: 'bot' | 'external'
  humanSeat: 1,       // -1 = none. Sets board.human and hw_parties_control[seat] = 'human' (quirk Q6)
  difficulty: 5,      // upstream default; keep 5
  maxRounds: 150,
  focusSeat: 1,       // seat whose elimination ends the game; default: first external seat, else humanSeat, else -1
  stopOnFocusElimination: true,   // false only in parity tests
});
game.status();        // { round, party, movesLeft, needsDecision, terminal, winner, endedBy }
game.legalActions();  // sorted unique action ids for the pending external decision, PASS included
game.legalMoves();    // [{ from: [x, y], to: [x, y], action }] (same set, PASS excluded)
game.applyAction(id); // external move or PASS; throws on illegal or when no decision is pending
game.applyBotMove();  // let the built-in bot make the pending external decision (Bot.makeMove semantics)
game.snapshot();  game.hash();  game.mapInfo();  game.drainEvents();
fromSnapshot(mapNumber, snapshot, options);         // restore (PLAN 1.4)
```

**Dispatch.** The engine dispatches by `controllers[]`, never by `hw_parties_control` (that field only
feeds bot scoring). `controllers` all `'bot'` with `humanSeat = s` is the **bot-in-seat** baseline.

**Turn flow.** After `createGame` and after every action the engine advances automatically until an
external decision is pending or the game is terminal. Each party turn follows the reference loop (§7).
For an `external` seat the move loop is replaced by decisions:

1. Compute `movePoints` (before cleanup, Q1), `cleanupTurn`, `updateBoard`.
2. If `movePoints == 0` the turn ends with no decision. Otherwise `movesLeft = movePoints` and a
   decision is pending. Legal actions: for each army of the party with `moved == false` (in
   `hw_parties_armies` order), its de-duplicated destinations; plus `PASS`. If no army has a destination,
   only `PASS` is legal.
3. A move calls `moveArmy(army, field, board)` then `updateArmies(board)`, and decrements `movesLeft`.
   It does not touch `wfs_*` (bot bookkeeping). `applyBotMove` instead runs upstream `makeMove`
   (including `wfs_*` updates and possible no-op).
4. When `movesLeft` reaches 0 or `PASS` is applied: `unitsSpawn` (Q7), then the next party.

**Terminal.** `endedBy = 'victory'` (checked after each full round, as upstream), `'turn_limit'`
(after `maxRounds` rounds), or `'eliminated'` (`focusSeat`'s status became 0 and
`stopOnFocusElimination` is true — checked after every move and party turn). `winner` = seat holding
all other capitals, else −1. Outcome for the focus seat: `win` if `winner == focusSeat`, `loss` if
eliminated, otherwise `limit`.

## 7. Reference turn loop (mirrors upstream `Game.js` + `Main.js`)

```
setup(mapNumber):
  board = Game.generateNewBoard() values; map = new Map(mapNumber, images)
  map.generateMap(board); map.updateBoard(board); map.calcAIHelpers(board)
  for p in 0..3: map.unitsSpawn(p, board); map.updateBoard(board)
round = 0
loop:
  board.turns = round
  for p in 0..3:
    board.turn_party = p
    board.duel = (number of seats i with capitals[i].party == i) < 3
    movePoints = map.getMovePoints(p, board)          # before cleanup (Q1)
    map.cleanupTurn(board); map.updateBoard(board)
    repeat movePoints times: map.makeMove(p, board); map.updateArmies(board)
    map.unitsSpawn(p, board)                           # no updateBoard here (as upstream)
  round += 1
  stop if map.isVictory(board) or round >= 150
```

The Phase 0 harness runs this against the unmodified upstream `Map.js` with `test/helpers/domStub.mjs`
installed and `console.warn` silenced.

## 8. Worker protocol (`tools/env-worker.mjs`)

Newline-delimited JSON over stdin/stdout, one request → one response, matched by `id`. One worker hosts
many game slots. Stderr is for logs only.

```jsonc
// requests
{"id": 1, "op": "hello"}                                   // → {"id":1,"ok":true,"rules_version":"...","engine_commit":"...","num_actions":3961}
{"id": 2, "op": "map_info", "map_numbers": [1234]}          // → {"maps": {"1234": <mapInfo>}}
{"id": 3, "op": "reset", "games": [{"slot": 0, "map_number": 1234, "controllers": ["bot", "external", "bot", "bot"],
                                      "human_seat": 1, "focus_seat": 1, "max_rounds": 150}]}
{"id": 4, "op": "step",  "actions": [{"slot": 0, "action": 1872}]}
{"id": 5, "op": "close"}
// reset/step response
{"id": 4, "ok": true, "results": [{"slot": 0, "snapshot": {...}, "hash": "...", "legal": [ ... ],
  "status": {"round": 3, "party": 1, "movesLeft": 2, "needsDecision": true, "terminal": false,
             "winner": -1, "endedBy": null},
  "events": [ ... optional, only if "events": true in reset ... ]}]}
// error
{"id": 4, "ok": false, "error": "illegal action 17 for slot 0"}
```

`reset` fields map one-to-one to `createGame` options; the bot-in-seat baseline is all `"bot"` with
`human_seat` and `focus_seat` set. Rewards are computed in Python from `status` and snapshots
(TRAINING.md §5). Use `orjson` in Python. If JSON parsing becomes the
bottleneck (profile first), add a binary frame mode; keep JSON as the reference.

## 9. Baseline measurements (upstream `8272cde`, original code + DOM stub)

Measured 2026-10-02 in a 2-vCPU cloud sandbox, Node 22.22, one core:

| Metric | Value |
| --- | --- |
| Full 4-bot games | 20 / 20 finished by victory |
| Rounds per game | mean 34.6 (40-game sample: min 20, median 30, max 53) |
| Bot moves per game | ~353 |
| Map setup (generate + AI helpers + spawn) | ~56 ms |
| Play time per game | ~262 ms (~0.74 ms per bot move) |
| Throughput | ~3.1 games/s per core |
| Legal destinations per army | mean 21.7 entries before de-dup, max 36 |
| CPU profile (self time) | `Bot.findBestMoveVal` 15%, `Pathfinder.getFurtherNeighbours` 14%, `Bot.finalProfitability` 13%, `Pathfinder.findPath` 11%, `Map.getField` 6%, `Map.updateBoard` 5% |
| Upstream tests | 37 / 37 pass |

Bot decision-making is ~60% of the time; rules ~20%. Cheap speedups, if needed later: cache neighbour
rings (`getFurtherNeighbours`) per map, cache `calcAIHelpers` per `map_id`, avoid string keys in
`getField`. Every speedup must keep the golden test green.
