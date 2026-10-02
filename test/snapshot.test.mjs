import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createReference, withoutWarnings } from './helpers/reference.mjs';
import { fnv1a64, snapshot, stateHash } from './helpers/snapshot.mjs';

test('FNV-1a 64 matches independent standard vectors', () => {
  const bytes = value => new TextEncoder().encode(value);
  assert.equal(fnv1a64(bytes('')), 'cbf29ce484222325');
  assert.equal(fnv1a64(bytes('a')), 'af63dc4c8601ec8c');
  assert.equal(fnv1a64(bytes('foobar')), '85944171f73967e8');
});

test('snapshot is detached, integer-only and sensitive to future-relevant state', () => {
  const { board } = withoutWarnings(() => createReference(1234));
  const state = snapshot(board);
  for (const value of Object.values(state)) {
    for (const scalar of Array.isArray(value) ? value : [value]) assert.ok(Number.isInteger(scalar));
  }
  for (const key of ['owner', 'army_party', 'army_count', 'army_morale', 'army_moved']) assert.equal(state[key].length, 220);
  const hash = stateHash(state);
  board.hw_parties_morale[0]++;
  assert.notEqual(stateHash(snapshot(board)), hash);
  assert.equal(stateHash(state), hash);
  const field = board.field.f1x1;
  board.hw_parties_wait_for_support_field[0] = field;
  assert.equal(snapshot(board).wfs_cell[0], 12);
});
