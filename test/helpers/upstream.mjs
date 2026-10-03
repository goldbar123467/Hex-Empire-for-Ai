import { execFileSync } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { UPSTREAM_COMMIT } from '../../engine/version.js';

// Immutable test oracle from Git, never imported by the production engine/browser.
// Keep the pinned commit in repository history; no network access is needed.
const root = fileURLToPath(new URL('../../', import.meta.url));
async function loadOracle(commit) {
  const directory = await mkdtemp(join(tmpdir(), 'hex-upstream-'));
  await writeFile(join(directory, 'package.json'), '{"type":"module"}');
  for (const name of ['Map', 'Bot', 'Pathfinder', 'Game', 'MapRender', 'Statistics', 'Replay', 'UI']) {
    const source = execFileSync('git', ['show', `${commit}:public/game/${name}.js`], { cwd: root });
    await writeFile(join(directory, `${name}.js`), source);
  }
  const modules = {
    ...await import(pathToFileURL(join(directory, 'Map.js'))),
    ...await import(pathToFileURL(join(directory, 'Game.js'))),
  };
  await rm(directory, { recursive: true });
  return modules;
}
export const { Map: UpstreamMap, Game: UpstreamGame } = await loadOracle(UPSTREAM_COMMIT);
export const { Map: GuardedMap } = await loadOracle('c1767af835316db0fa27b8f0cb5e20bb300f1142');
