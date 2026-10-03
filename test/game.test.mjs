import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createGame, PASS } from '../engine/index.js';

const fixture = JSON.parse(await readFile(new URL('./fixtures/golden/v1.1.json', import.meta.url), 'utf8'));
test('complete Game API matches 101 independent golden trajectories', () => {
  for (const expected of fixture.games) {
    const hashes = [];
    const game = createGame({ mapNumber: expected.map_number, onSetup: g => hashes.push(g.hash()), onPartyTurn: g => hashes.push(g.hash()) });
    assert.deepEqual(hashes, expected.hashes, `game API map ${expected.map_number}`);
    assert.equal(game.result().rounds, expected.rounds);
    assert.equal(game.result().winner, expected.winner);
  }
});

test('external bot decisions preserve 20 original turn flows', () => {
  for (const expected of fixture.games.slice(0,20)) {
    const hashes = [];
    const game = createGame({ mapNumber: expected.map_number, controllers: ['external','bot','bot','bot'], humanSeat: -1, stopOnFocusElimination: false,
      onSetup: g => hashes.push(g.hash()), onPartyTurn: g => hashes.push(g.hash()) });
    while (!game.status().terminal) game.applyBotMove();
    assert.deepEqual(hashes, expected.hashes, `external map ${expected.map_number}`);
  }
});

test('illegal actions are atomic; pass ends a turn; manual bots finish', () => {
  const game = createGame({ mapNumber: 1234, controllers: ['external','bot','bot','bot'], humanSeat: 0, autoAdvanceBots: false, maxRounds: 2, recordDecisions: true });
  const before = game.hash();
  assert.throws(() => game.applyAction(-1), /Illegal/);
  assert.equal(game.hash(), before);
  assert.ok(game.legalActions().includes(PASS));
  game.applyAction(PASS);
  assert.notEqual(game.hash(), before);
  while (!game.status().terminal) {
    if (game.status().needsDecision) game.applyAction(PASS); else game.advance();
  }
  const decisions = game.drainEvents().filter(e => e.type === 'decision');
  assert.deepEqual(decisions.map(e => e.i), Array.from({length: decisions.length}, (_,i)=>i));
  assert.equal(game.result().ended_by, 'turn_limit');
  assert.equal(game.result().rounds, 2);
});
