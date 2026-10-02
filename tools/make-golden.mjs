import { readFile, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { playReference, UPSTREAM_COMMIT } from '../test/helpers/reference.mjs';
import { snapshot, stateHash } from '../test/helpers/snapshot.mjs';

const { values } = parseArgs({ options: { out: { type: 'string', default: 'test/fixtures/golden/v1.json' } } });
const maps = JSON.parse(await readFile(new URL('../test/fixtures/golden/maps.json', import.meta.url), 'utf8'));
const games = maps.map(mapNumber => {
  const hashes = [];
  const record = board => hashes.push(stateHash(snapshot(board)));
  const { rounds, winner } = playReference(mapNumber, { afterSetup: record, afterParty: record });
  return { map_number: mapNumber, hashes, rounds, winner };
});
await writeFile(values.out, JSON.stringify({ rules_version: 'v1-upstream-8272cde', upstream_commit: UPSTREAM_COMMIT, games }) + '\n');
console.log(`Recorded ${games.length} unmodified upstream games to ${values.out}`);
