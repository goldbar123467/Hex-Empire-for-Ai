import { test } from 'node:test';
import assert from 'node:assert/strict';
import { playReference, withoutWarnings } from './helpers/reference.mjs';
import { Map } from '../public/game/Map.js';

test('a ranked army without a destination consumes a no-op without moving', () => {
  const map = Object.create(Map.prototype);
  const army = { count: 20, morale: 10, moved: false };
  map.bot = { calcArmiesProfitability: () => [army] };
  map.moveArmy = () => assert.fail('a missing destination must not reach moveArmy');
  const board = { hw_parties_names: ['Redosia'] };
  withoutWarnings(() => map.makeMove(0, board));
  assert.deepEqual(army, { count: 20, morale: 10, moved: false });
});

test('map 107 reproduces the original defect and completes with the guard', () => {
  assert.throws(() => playReference(107, { legacy: true }), /wait_for_support/);
  const result = playReference(107);
  assert.ok(result.rounds <= 150);
  assert.ok(result.winner >= 0 || result.rounds === 150);
});
