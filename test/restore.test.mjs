import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createGame, fromSnapshot, PASS } from '../engine/index.js';
import { packGraph, unpackGraph } from '../engine/continuation.js';
const fixture = JSON.parse(await readFile(new URL('./fixtures/golden/v1.1.json',import.meta.url),'utf8'));

test('restore at seeded random party boundaries matches 50 golden game suffixes', t=>{
  t.mock.method(console,'warn',()=>{});
  let seed = 20261002;
  for (const golden of fixture.games.slice(0,50)) {
    seed = (Math.imul(seed,1664525)+1013904223)>>>0;
    const boundary = seed % (golden.hashes.length-1);
    let index = 0, saved;
    createGame({mapNumber:golden.map_number,onPartyTurn:g=>{if(index++ === boundary) saved = JSON.parse(JSON.stringify(g.snapshot({continuation:true})));}});
    const hashes = [];
    const restored = fromSnapshot(golden.map_number,saved,{onPartyTurn:g=>hashes.push(g.hash())});
    assert.deepEqual(hashes,golden.hashes.slice(boundary+2),`suffix map ${golden.map_number}`);
    assert.equal(restored.hash(),golden.hashes.at(-1));
    assert.equal(restored.result().winner,golden.winner);
    assert.equal(restored.result().rounds,golden.rounds);
  }
});

test('restore after external actions preserves masks, hidden state and decision counters',()=>{
  let game = createGame({mapNumber:107,controllers:['external','bot','bot','bot'],humanSeat:0,autoAdvanceBots:false});
  for(let i=0;i<85 && !game.terminal;i++) {
    if(game.status().needsDecision) game.applyAction(game.legalMoves().at(-1)?.action ?? PASS); else game.advance();
  }
  const saved = JSON.parse(JSON.stringify(game.snapshot({continuation:true})));
  const restored = fromSnapshot(107,saved);
  assert.deepEqual(restored.snapshot({continuation:true}),saved);
  while(!game.terminal) {
    assert.deepEqual(restored.legalActions(),game.legalActions());
    if(game.status().needsDecision) { const action=game.legalMoves()[0]?.action ?? PASS; game.applyAction(action);restored.applyAction(action); }
    else { game.advance();restored.advance(); }
    assert.equal(restored.hash(),game.hash());
  }
  assert.deepEqual(restored.result(),game.result());
  assert.throws(()=>fromSnapshot(107,game.snapshot()),/omit bot memory/);
  assert.throws(()=>fromSnapshot(108,saved),/mismatch/);
});

test('continuations preserve shared references and non-finite upstream values',()=>{
  const board = {nan:NaN,negativeZero:-0,values:[undefined,Infinity,-Infinity]};
  board.self=board;board.shared=board.values;
  const copy=unpackGraph(JSON.parse(JSON.stringify(packGraph(board))));
  assert.deepEqual(copy,board);
  assert.equal(copy.self,copy);assert.equal(copy.shared,copy.values);
  assert.throws(()=>unpackGraph({root:['ref',0],nodes:[{array:false,entries:[['__proto__',null]]}]}),/property/);
});
