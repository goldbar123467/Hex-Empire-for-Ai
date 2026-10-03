# Decisions

- 2026-10-02: Start from Samuel Yuan's MIT-licensed HexEmpireAI commit `8272cde7fce46520cffc3c845ed3f83ff95ead0a`, as specified by the owner. Source and license inspected locally; retain upstream rules and credit. The working checkout is `HexAI/hexempire-rl`; supplied credential files stay outside it.
- 2026-10-02: Preserve phase order and use unmodified upstream rules for Phase 0 reference fixtures. No training starts before engine parity and replay verification; server setup is authorized by the owner's current request.
- 2026-10-02: Research preflight retained the owner's engine and imitation-learning plan. [Huang and Ontanon, invalid action masking, arXiv:2006.14171v2](https://arxiv.org/html/2006.14171v2) supports consistent masks for sampling and policy updates (methods inspected; no reproduction). [Ross, Gordon, Bagnell, DAgger, arXiv:1011.0686v3](https://arxiv.org/abs/1011.0686v3) is relevant to later distribution shift (abstract inspected only; no method change). [CleanRL](https://github.com/vwxyzjn/cleanrl) is a later PPO reference, not a dependency or copied implementation; code-level review deferred until the training phase.

- 2026-10-02: Owner selected `goldbar123467/Hex-Empire-for-Ai` and requested regular commits. Preserve its initial commit alongside upstream history; use `origin` for the owner repo and `upstream` for the reference source. WSL GitHub profile and the initial project commit both identify Clark Kitchen; use that identity locally.
- 2026-10-02: Updated the transitive `qs` dependency within Express's declared range after `npm audit` reported two denial-of-service advisories. No game-source change; post-update audit reports zero known vulnerabilities.

## Open questions

- 2026-10-02: May we version a minimal no-destination guard for upstream map 107? `node tools/bench.mjs --games 200` crashes in unmodified `Map.makeMove` because the first ranked army has no `.move`; the original `Game.runTurn` reproduces it. Proposed behavior: if the first ranked army has no destination, consume this bot move point as a no-op. Preserve stale-but-defined moves (Q5) and all existing golden trajectories. This is a behavior extension to a previously crashing state, so AGENTS.md requires owner approval before applying it or advancing past Phase 0.
