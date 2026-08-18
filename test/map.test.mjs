import { before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { installDomStub } from './helpers/domStub.mjs';

// Map.js touches `document` from its own constructor, so stub before importing.
before(() => installDomStub());
const { Map } = await import('../public/game/Map.js');

function makeMap(seed = 12345) {
  return new Map(seed, {});
}

describe('Map#rand', () => {
  test('is deterministic for a given seed', () => {
    const a = makeMap(42);
    const b = makeMap(42);
    const seriesA = Array.from({ length: 20 }, () => a.rand(1000));
    const seriesB = Array.from({ length: 20 }, () => b.rand(1000));
    assert.deepEqual(seriesA, seriesB);
  });

  test('produces values within [0, n)', () => {
    const m = makeMap(7);
    for (let i = 0; i < 200; i++) {
      const v = m.rand(37);
      assert.ok(v >= 0 && v < 37);
    }
  });

  test('different seeds diverge', () => {
    const a = makeMap(1);
    const b = makeMap(2);
    const seriesA = Array.from({ length: 10 }, () => a.rand(1e6));
    const seriesB = Array.from({ length: 10 }, () => b.rand(1e6));
    assert.notDeepEqual(seriesA, seriesB);
  });
});

describe('Map#shuffle', () => {
  test('returns a permutation of the input (same length, same elements)', () => {
    const m = makeMap(99);
    const input = Array.from({ length: 30 }, (_, i) => i);
    const shuffled = m.shuffle(input);
    assert.equal(shuffled.length, input.length);
    assert.deepEqual([...shuffled].sort((x, y) => x - y), input);
  });

  test('does not mutate the input array', () => {
    const m = makeMap(5);
    const input = [1, 2, 3, 4, 5];
    const copy = [...input];
    m.shuffle(input);
    assert.deepEqual(input, copy);
  });

  test('is deterministic for a given seed', () => {
    const input = Array.from({ length: 10 }, (_, i) => i);
    assert.deepEqual(makeMap(123).shuffle(input), makeMap(123).shuffle(input));
  });
});

describe('Map#attack', () => {
  test('a stronger attacker destroys the defender and survives at reduced strength', () => {
    const m = makeMap(1);
    const board = { hw_parties_armies: [[], []] };
    const attacker = { count: 80, morale: 20, party: 0 };
    const defender = { count: 10, morale: 5, party: 1 };
    const field = { army: defender };

    assert.equal(m.attack(attacker, field, board), true);
    assert.ok(attacker.count > 0 && attacker.count <= 80);
  });

  test('a stronger defender repels the attacker and survives at reduced strength', () => {
    const m = makeMap(1);
    const board = { hw_parties_armies: [[], []] };
    const attacker = { count: 10, morale: 5, party: 0 };
    const defender = { count: 80, morale: 20, party: 1 };
    const field = { army: defender };

    assert.equal(m.attack(attacker, field, board), false);
    assert.ok(defender.count > 0 && defender.count <= 80);
  });

  test('an empty field is trivially taken', () => {
    const m = makeMap(1);
    assert.equal(m.attack({ count: 5, morale: 1, party: 0 }, { army: null }, {}), true);
  });
});

describe('Map#checkPartyState / isVictory', () => {
  function makeBoard(capitals) {
    return {
      hw_init: false,
      hw_parties_capitals: capitals,
      hw_parties_armies: capitals.map(() => []),
      hw_parties_provinces_cp: capitals.map(() => null),
      hw_parties_status: capitals.map(() => 0),
      hw_parties_count: capitals.length,
    };
  }

  test('a party holding only its own capital has status 1', () => {
    const m = makeMap(1);
    const board = makeBoard([{ party: 0 }, { party: 1 }]);
    m.checkPartyState(0, board);
    assert.equal(board.hw_parties_status[0], 1);
    assert.equal(board.hw_parties_provinces_cp[0], null);
  });

  test('a party that lost its own capital has status 0', () => {
    const m = makeMap(1);
    const board = makeBoard([{ party: 1 }, { party: 1 }]);
    m.checkPartyState(0, board);
    assert.equal(board.hw_parties_status[0], 0);
  });

  test('a party occupying an undefended enemy capital gets credit for it, and isVictory follows', () => {
    const m = makeMap(1);
    // party 0 holds both capitals; party 1's has no armies left defending it
    const board = makeBoard([{ party: 0 }, { party: 0 }]);
    m.checkPartyState(0, board);
    assert.equal(board.hw_parties_status[0], 2);
    assert.deepEqual(board.hw_parties_provinces_cp[0], [board.hw_parties_capitals[1]]);
    assert.equal(m.isVictory(board), true);
  });
});
