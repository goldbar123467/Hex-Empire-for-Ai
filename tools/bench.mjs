import os from 'node:os';
import { performance } from 'node:perf_hooks';
import { parseArgs } from 'node:util';
import { playReference, UPSTREAM_COMMIT } from '../test/helpers/reference.mjs';
import { RULES_VERSION } from '../engine/version.js';

const { values } = parseArgs({ options: { games: { type: 'string', default: '200' }, legacy: { type: 'boolean', default: false } } });
const count = Number(values.games);
if (!Number.isSafeInteger(count) || count < 1) throw new Error('--games must be a positive integer');
playReference(233279, { legacy: values.legacy }); // JIT warmup, excluded from measurement.
let rounds = 0;
let moves = 0;
const started = performance.now();
for (let i = 0; i < count; i++) {
  let result;
  try { result = playReference(i, { legacy: values.legacy }); }
  catch (cause) { throw new Error(`Game failed on map ${i}; benchmark incomplete`, { cause }); }
  rounds += result.rounds;
  moves += result.moves;
}
const elapsed = performance.now() - started;
console.log(JSON.stringify({
  mode: values.legacy ? 'legacy' : 'upstream-guarded', upstream_commit: UPSTREAM_COMMIT,
  rules_version: values.legacy ? 'v1-upstream-8272cde' : RULES_VERSION,
  node: process.version, platform: `${os.platform()} ${os.arch()}`,
  cpu: os.cpus()[0]?.model, logical_cpus: os.cpus().length,
  workers: 1, games: count, games_per_second: count * 1000 / elapsed,
  ms_per_game: elapsed / count, mean_rounds: rounds / count,
  bot_move_points_per_game: moves / count,
}, null, 2));
