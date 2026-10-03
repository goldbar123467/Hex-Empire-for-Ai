import { execFileSync } from 'node:child_process';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { UPSTREAM_COMMIT } from '../../engine/version.js';

// Immutable test oracle from Git, never imported by the production engine/browser.
// Keep the pinned commit in repository history; no network access is needed.
const directory = await mkdtemp(join(tmpdir(), 'hex-upstream-'));
const root = fileURLToPath(new URL('../../', import.meta.url));
await writeFile(join(directory, 'package.json'), '{"type":"module"}');
for (const name of ['Map', 'Bot', 'Pathfinder', 'Game', 'MapRender', 'Statistics', 'Replay', 'UI']) {
  const source = execFileSync('git', ['show', `${UPSTREAM_COMMIT}:public/game/${name}.js`], { cwd: root });
  await writeFile(join(directory, `${name}.js`), source);
}
export const { Map: UpstreamMap } = await import(pathToFileURL(join(directory, 'Map.js')));
export const { Game: UpstreamGame } = await import(pathToFileURL(join(directory, 'Game.js')));
