# Hex Empire for AI

Play one empire against three bots, record every decision locally, and replay-verify each saved
game. The browser and Node use the same deterministic JavaScript engine. Four-bot spectating and
post-game map review also work. Python training, dataset builds and public releases are later phases.

## Play locally

Use Node 22 and npm 10:

```sh
git clone https://github.com/goldbar123467/Hex-Empire-for-Ai.git
cd Hex-Empire-for-Ai
npm ci
npm start
```

Open [the local game](http://127.0.0.1:3000). Choose a map, empire and pseudonym, then start a campaign.
Click a bright-ringed army and a highlighted destination. Army labels show **troops / morale**.
Press **E** or click **End turn** to pass. There is no undo. Take the other three capitals to win;
losing your capital ends your human game. Games stop after 150 rounds.

On a narrow screen the map scrolls horizontally. Town names are optional. After a game ends,
use **Review game** to inspect earlier rounds or **Final board** to return to the final position.

## Local recordings

Human games save to `data/raw/human/<UTC-date>/<game-id>.jsonl` at the start, after each completed
round, and at game end. Every saved prefix is replay-verified before an atomic write. The status
**Saved & replay verified** confirms a finished game was saved and its final hash reproduced.

**Download game log** is available during and after a game, including when disk saving fails.
If a tab closes mid-game, the latest saved prefix is retained and classified as `abandoned`.
An abandoned log is excluded from complete-game datasets. Spectator games are not human recordings.
Only the chosen pseudonym and UTC date are logged; no IP address or exact clock time is recorded.

```sh
node tools/verify-log.mjs data/raw/human/
```

Verification prints `ok`, `abandoned`, or `failed` with the failing line. Files stay in place unless
`--quarantine` is explicitly supplied. Automated UI logs live in `test-results/`, never in the
owner's human-data directory. Use a clean Git checkout when collecting real games; development
recordings identify their engine commit with a `-dirty` suffix.

## Checks and engine tools

```sh
npm test
npm run test:ui
node tools/play.mjs --map 1234 --controllers bot,bot,bot,bot
node tools/bench.mjs --games 200 --compare
```

The UI tests require Chromium. On a fresh installation, run `npx playwright install chromium`.
If `PLAYWRIGHT_BROWSERS_PATH` is already set, reuse that installation instead of downloading browsers.
An existing compatible Chromium executable can be selected with `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`.

Checks cover 101 golden trajectories, external actions, JSON snapshot continuation, log corruption,
atomic saves, full browser play, keyboard PASS, mobile layout and the download fallback.
Rules v1.1 includes the documented guard for the original bot's missing-destination crash.
`test/fixtures/golden/v1.json` remains the immutable original reference. `--legacy` on the benchmark
uses the unmodified upstream code, including its original map-107 failure. See
[measured results](docs/RESULTS.md) and [the phase checklist](docs/PLAN.md).

## Server and credentials

Human play and raw human logs stay on the owner's PC. The same source is also installed at
`/workspace/hexempire-rl` on the rented Vast instance for later generation and training. That
instance has no persistent volume: source and irreplaceable outputs must also exist off the box.
The web server binds to localhost. `PORT` changes the port; `HEX_LOG_DIR` overrides the human-log
output directory for tests. Credentials, raw data, checkpoints and virtual environments are ignored
by Git. Never put tokens in tracked configuration.

## Credits and license

Based on Samuel Yuan's [HexEmpireAI](https://github.com/samuelyuan/HexEmpireAI), pinned to
`8272cde7fce46520cffc3c845ed3f83ff95ead0a`. Original game: Hex Empire. Project additions:
Clark Kitchen. MIT; the upstream copyright notice is preserved in [LICENSE](LICENSE).
