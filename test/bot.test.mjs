import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { Bot } from '../public/game/Bot.js';
import { Pathfinder } from '../public/game/Pathfinder.js';
import { buildHexGrid } from './helpers/hexGrid.mjs';

describe('Bot#calcNeighboursPower / calcEnemyNeighboursPower', () => {
  test('sums count+morale of armies split by party across the further-neighbour ring', () => {
    const bot = new Bot(new Pathfinder());
    const grid = buildHexGrid(5, 5);
    const center = grid.get(2, 2);

    center.neighbours[0].army = { party: 0, count: 10, morale: 5 };   // friendly
    center.neighbours[1].army = { party: 1, count: 20, morale: 1 };   // enemy
    center.neighbours[2].army = { party: 0, count: 3, morale: 2 };    // friendly

    assert.equal(bot.calcNeighboursPower(0, center), 10 + 5 + 3 + 2);
    assert.equal(bot.calcEnemyNeighboursPower(0, center), 20 + 1);
  });

  test('is zero when no neighbours have armies', () => {
    const bot = new Bot(new Pathfinder());
    const grid = buildHexGrid(3, 3);
    const center = grid.get(1, 1);
    assert.equal(bot.calcNeighboursPower(0, center), 0);
    assert.equal(bot.calcEnemyNeighboursPower(0, center), 0);
  });
});

describe('Bot#getMovableArmies', () => {
  test('filters out armies that have already moved this turn', () => {
    const bot = new Bot(new Pathfinder());
    const moved = { moved: true };
    const notMoved1 = { moved: false };
    const notMoved2 = { moved: false };
    const board = { hw_parties_armies: [[moved, notMoved1, notMoved2]] };

    assert.deepEqual(bot.getMovableArmies(0, board), [notMoved1, notMoved2]);
  });

  test('returns an empty array when the party has no armies', () => {
    const bot = new Bot(new Pathfinder());
    const board = { hw_parties_armies: [[]] };
    assert.deepEqual(bot.getMovableArmies(0, board), []);
  });
});
