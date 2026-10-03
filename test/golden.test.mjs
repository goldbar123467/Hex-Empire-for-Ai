import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { playReference, UPSTREAM_COMMIT } from './helpers/reference.mjs';
import { snapshot, stateHash } from './helpers/snapshot.mjs';

const fixture = JSON.parse(await readFile(new URL('./fixtures/golden/v1.json', import.meta.url), 'utf8'));
test('100 original upstream games match every setup and party-turn hash', () => {
  assert.equal(fixture.upstream_commit, UPSTREAM_COMMIT);
  assert.equal(fixture.games.length, 100);
  assert.equal(new Set(fixture.games.map(g => g.map_number)).size, 100);
  for (const expected of fixture.games) {
    const hashes = [];
    const record = board => hashes.push(stateHash(snapshot(board)));
    const actual = playReference(expected.map_number, { afterSetup: record, afterParty: record });
    assert.equal(expected.hashes.length, 1 + 4 * expected.rounds);
    assert.deepEqual(hashes, expected.hashes, `map ${expected.map_number}`);
    assert.equal(actual.rounds, expected.rounds);
    assert.equal(actual.winner, expected.winner);
  }
});
