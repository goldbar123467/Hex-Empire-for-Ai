import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Rules } from '../engine/rules.js';
import { createBoard } from '../engine/board.js';
import { snapshot, stateHash } from '../engine/snapshot.js';
import { playReference } from './helpers/reference.mjs';

test('headless rules match all 101 guarded golden games at every party boundary', async () => {
  const fixture = JSON.parse(await readFile(new URL('./fixtures/golden/v1.1.json', import.meta.url), 'utf8'));
  for (const expected of fixture.games) {
    const hashes = [];
    const record = board => hashes.push(stateHash(snapshot(board)));
    const actual = playReference(expected.map_number, {
      MapClass: Rules, boardFactory: createBoard, afterSetup: record, afterParty: record,
    });
    assert.deepEqual(hashes, expected.hashes, `headless map ${expected.map_number}`);
    assert.equal(actual.rounds, expected.rounds);
    assert.equal(actual.winner, expected.winner);
  }
});
