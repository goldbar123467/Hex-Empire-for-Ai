import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cells, offsets, PASS, encodeAction, decodeAction, oddQToAxial, axialToOddQ, hexDistance } from '../engine/hexgrid.js';
import { Rules } from '../engine/rules.js';
import { createBoard } from '../engine/board.js';

test('every cell and offset round-trips, including masked off-board destinations', () => {
  assert.equal(cells.length, 220); assert.equal(offsets.length, 18);
  for (const cell of cells) {
    assert.deepEqual(axialToOddQ(cell.q, cell.r), [cell.x,cell.y]);
    for (let k=0;k<18;k++) {
      const id = (cell.x*11+cell.y)*18+k;
      const {from,to} = decodeAction(id);
      assert.equal(encodeAction(from,to),id);
    }
  }
  assert.deepEqual(decodeAction(PASS),{from:null,to:null});
});

test('upstream neighbours and all playable destinations have correct axial distance', () => {
  const map = new Rules(1234), board = createBoard();
  map.generateMap(board);
  for (const cell of cells) {
    const field = map.getField(cell.x,cell.y,board);
    for (const neighbour of field.neighbours.filter(Boolean)) {
      const [q,r] = oddQToAxial(neighbour.fx,neighbour.fy);
      assert.equal(hexDistance(q-cell.q,r-cell.r),1);
    }
    for (const target of map.pathfinder.getPossibleMoves(field, {excludeSelf:true})) {
      const [tq,tr]=oddQToAxial(target.fx,target.fy);
      assert.ok(hexDistance(tq-cell.q,tr-cell.r)>=1 && hexDistance(tq-cell.q,tr-cell.r)<=2);
      assert.deepEqual(decodeAction(encodeAction([cell.x,cell.y],[target.fx,target.fy])).to,[target.fx,target.fy]);
    }
  }
});
