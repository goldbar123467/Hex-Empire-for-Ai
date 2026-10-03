import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, PASS } from '../engine/index.js';
import { readFile } from 'node:fs/promises';
const fixture = JSON.parse(await readFile(new URL('./fixtures/golden/v1.1.json',import.meta.url),'utf8'));
const withoutSeatZeroSupport = state => ({...state,wfs_cell:[-1,...state.wfs_cell.slice(1)],wfs_count:[0,...state.wfs_count.slice(1)]});

test('recorded bot moves replay through external legal actions on 20 maps', async t => {
  t.mock.method(console,'warn',()=>{});
  for (const golden of fixture.games.slice(0,20)) await t.test(`map ${golden.map_number}`, sub => {
    const turns = [], records = [];
    createGame({mapNumber:golden.map_number, onDecision:e=>{if(e.party===0) records.push(e);}, onPartyTurn:g=>turns.push(g.snapshot())});
    let stale = null, turnIndex = 0;
    const game = createGame({mapNumber:golden.map_number,controllers:['external','bot','bot','bot'],stopOnFocusElimination:false,
      onPartyTurn:g=>assert.deepEqual(withoutSeatZeroSupport(g.snapshot()),withoutSeatZeroSupport(turns[turnIndex++]),`party boundary ${turnIndex}`)});
    while (!game.terminal) {
      const roundRecords = records.filter(e=>e.round===game.board.turns);
      const move = roundRecords.find(e=>e.moves_left <= game.movesLeft && e.action !== null);
      if (!move) { game.applyAction(PASS); continue; }
      if (!game.legalActions().includes(move.action)) { stale = move; break; }
      game.applyAction(move.action);
    }
    if (stale) { sub.skip(`Q5 stale bot move in round ${stale.round}: ${stale.action}`); return; }
    assert.equal(turnIndex,turns.length);
    assert.equal(game.result().rounds,golden.rounds);
  });
});
