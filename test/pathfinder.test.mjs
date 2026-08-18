import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { Pathfinder } from '../public/game/Pathfinder.js';
import { buildHexGrid } from './helpers/hexGrid.mjs';

describe('Pathfinder#canWalk', () => {
  const pf = new Pathfinder();

  test('rejects when either field is missing', () => {
    const land = { type: 'land', estate: undefined };
    assert.equal(pf.canWalk(undefined, land, [], true), false);
    assert.equal(pf.canWalk(land, undefined, [], true), false);
  });

  test('rejects a destination whose estate is on the avoid list', () => {
    const a = { type: 'land', estate: undefined };
    const b = { type: 'land', estate: 'town' };
    assert.equal(pf.canWalk(a, b, ['town'], true), false);
  });

  test('allows any type pairing when avoid_water is false', () => {
    const a = { type: 'land', estate: undefined };
    const b = { type: 'water', estate: undefined };
    assert.equal(pf.canWalk(a, b, [], false), true);
  });

  test('blocks land -> water unless the origin is a port', () => {
    const nonPort = { type: 'land', estate: undefined };
    const port = { type: 'land', estate: 'port' };
    const water = { type: 'water', estate: undefined };
    assert.equal(pf.canWalk(nonPort, water, [], true), false);
    assert.equal(pf.canWalk(port, water, [], true), true);
  });

  test('allows every other type pairing when avoiding water', () => {
    const land = { type: 'land', estate: undefined };
    const water = { type: 'water', estate: undefined };
    assert.equal(pf.canWalk(land, land, [], true), true);
    assert.equal(pf.canWalk(water, land, [], true), true);
    assert.equal(pf.canWalk(water, water, [], true), true);
  });
});

describe('Pathfinder#getDistance', () => {
  const pf = new Pathfinder();

  test('is zero for a field and itself', () => {
    const field = { fx: 3, fy: 4 };
    assert.equal(pf.getDistance(field, field), 0);
  });

  test('matches the hand-computed hex distance for known coordinates', () => {
    // acx=0,acy=0 (fx even) ; bcx=5,bcy=5 (fx odd -> +5) => sqrt(5^2+5^2)
    const a = { fx: 0, fy: 0 };
    const b = { fx: 1, fy: 0 };
    assert.ok(Math.abs(pf.getDistance(a, b) - Math.sqrt(50)) < 1e-9);
  });

  test('is symmetric', () => {
    const a = { fx: 2, fy: 5 };
    const b = { fx: 6, fy: 1 };
    assert.equal(pf.getDistance(a, b), pf.getDistance(b, a));
  });
});

describe('Pathfinder#getFurtherNeighbours', () => {
  const pf = new Pathfinder();

  test('returns the 6 direct neighbours plus 12 second-ring slots for an interior field', () => {
    const grid = buildHexGrid(5, 5);
    const center = grid.get(2, 2);
    const further = pf.getFurtherNeighbours(center);
    assert.equal(further.length, 18);
    for (const n of center.neighbours) {
      assert.ok(further.includes(n));
    }
  });

  test('does not throw for an edge field with missing neighbours', () => {
    const grid = buildHexGrid(3, 3);
    const corner = grid.get(0, 0);
    assert.doesNotThrow(() => pf.getFurtherNeighbours(corner));
  });
});

describe('Pathfinder#getPossibleMoves', () => {
  const pf = new Pathfinder();

  test('includes self by default and every empty land neighbour', () => {
    const grid = buildHexGrid(5, 5);
    const center = grid.get(2, 2);
    const moves = pf.getPossibleMoves(center);
    assert.ok(moves.includes(center));
    for (const n of center.neighbours) {
      assert.ok(moves.includes(n));
    }
  });

  test('excludes self when excludeSelf is set', () => {
    const grid = buildHexGrid(5, 5);
    const center = grid.get(2, 2);
    const moves = pf.getPossibleMoves(center, { excludeSelf: true });
    assert.ok(!moves.includes(center));
  });

  test('a same-party army under the cap is joinable; at the cap it is not', () => {
    const grid = buildHexGrid(5, 5);
    const center = grid.get(2, 2);
    center.army = { party: 0, count: 10 }; // the moving army
    const neighbour = center.neighbours[0];

    neighbour.army = { party: 0, count: 50 };
    let moves = pf.getPossibleMoves(center, { excludeSelf: true });
    assert.ok(moves.includes(neighbour));

    neighbour.army = { party: 0, count: 99 };
    moves = pf.getPossibleMoves(center, { excludeSelf: true });
    assert.ok(!moves.includes(neighbour));
  });

  test('an enemy-occupied neighbour is always reachable (attackable)', () => {
    const grid = buildHexGrid(5, 5);
    const center = grid.get(2, 2);
    center.army = { party: 0, count: 10 };
    const neighbour = center.neighbours[0];
    neighbour.army = { party: 1, count: 99 };
    const moves = pf.getPossibleMoves(center, { excludeSelf: true });
    assert.ok(moves.includes(neighbour));
  });
});

describe('Pathfinder#findPath', () => {
  const pf = new Pathfinder();

  test('returns null when either endpoint is missing', () => {
    assert.equal(pf.findPath(null, {}, [], true), null);
    assert.equal(pf.findPath({}, null, [], true), null);
  });

  test('finds a path along a straight line of land fields', () => {
    const grid = buildHexGrid(6, 1);
    const start = grid.get(0, 0);
    const end = grid.get(4, 0);
    const path = pf.findPath(start, end, [], true);
    assert.ok(path);
    assert.equal(path[0], start);
    assert.equal(path[path.length - 1], end);
  });

  test('returns null when the destination is unreachable without crossing water', () => {
    // A single water column splits the grid in two, with no port to cross from.
    const grid = buildHexGrid(5, 3, (x) => (x === 2 ? 'water' : 'land'));
    const start = grid.get(0, 1);
    const end = grid.get(4, 1);
    const path = pf.findPath(start, end, [], true);
    assert.equal(path, null);
  });
});
