import { readFile, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { playReference, UPSTREAM_COMMIT } from '../test/helpers/reference.mjs';
import { snapshot, stateHash } from '../test/helpers/snapshot.mjs';
import { RULES_VERSION } from '../engine/version.js';

const { values } = parseArgs({ options: { out: { type: 'string' }, legacy: { type: 'boolean', default: false } } });
const output = values.out ?? `test/fixtures/golden/${values.legacy ? 'v1' : 'v1.1'}.json`;
const maps = JSON.parse(await readFile(new URL('../test/fixtures/golden/maps.json', import.meta.url), 'utf8'));
if (!values.legacy) maps.push(107);
const games = maps.map(mapNumber => {
  const hashes = [];
  const record = board => hashes.push(stateHash(snapshot(board)));
  const { rounds, winner } = playReference(mapNumber, { afterSetup: record, afterParty: record, legacy: values.legacy });
  return { map_number: mapNumber, hashes, rounds, winner };
});
await writeFile(output, JSON.stringify({ rules_version: values.legacy ? 'v1-upstream-8272cde' : RULES_VERSION, upstream_commit: UPSTREAM_COMMIT, games }) + '\n');
console.log(`Recorded ${games.length} ${values.legacy ? 'original' : 'guarded'} games to ${output}`);
