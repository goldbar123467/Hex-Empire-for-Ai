# Hex Empire for AI

A deterministic Hex Empire research project based on Samuel Yuan's
[HexEmpireAI](https://github.com/samuelyuan/HexEmpireAI), pinned to
`8272cde7fce46520cffc3c845ed3f83ff95ead0a`.

The current implementation runs one shared deterministic engine in the browser and Node, plus a
reference harness. Human controls, decision recording, datasets, and training
are planned but **not ready yet**. See [the phase checklist](docs/PLAN.md).

## Run locally

Use Node 22 and npm 10. The implementation is currently on the Phase 1 branch:

```sh
git clone -b phase1/engine-tools https://github.com/goldbar123467/Hex-Empire-for-Ai.git
cd Hex-Empire-for-Ai
npm ci
npm test
node server.js
```

Open `http://localhost:3000` to watch the original bot game. The recording UI
will replace this workflow when Phase 2 passes its automated checks.

## Reference verification

```sh
node tools/make-golden.mjs --out /tmp/golden.json
node tools/bench.mjs --games 200
```

`test/fixtures/golden/v1.json` records setup and every party-turn hash for 100
maps. The harness also has a test against the actual upstream `Game` turn methods.
Rules v1.1 adds an owner-approved no-op guard for an upstream crash on map 107.
All original hashes are preserved; the guarded 200-map benchmark completes.
Use `--legacy` for the unmodified reference, including its original failure.
See [measured results](docs/RESULTS.md).

## Data and credentials

Human games will be recorded on the owner's PC. Source control excludes
`data/`, `runs/`, model files, virtual environments, and credentials. Never put
tokens in tracked configuration. The rented Vast server has no persistent
volume; source and irreplaceable outputs must also exist off that instance.

## Credits and license

Game implementation: Samuel Yuan, HexEmpireAI, MIT. Original game: Hex Empire.
Project additions: Clark Kitchen, MIT. The upstream copyright notice is
preserved in [LICENSE](LICENSE).
