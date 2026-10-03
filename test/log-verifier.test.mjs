import { test } from 'node:test';
import assert from 'node:assert/strict';
import {createGame,PASS,RULES_VERSION} from '../engine/index.js';
import {verifyLog} from '../tools/lib/verify-log.mjs';
function fixture({source='human',maxRounds=150,hashMode='every_decision'}={}){
 const human=source==='human';
 const header={type:'header',schema_version:1,game_id:'test-game',source,rules_version:RULES_VERSION,engine_commit:'c'.repeat(40),map_number:1234,map_id:1234,controllers:human?['human','bot','bot','bot']:['bot','bot','bot','bot'],human_seat:human?0:-1,difficulty:5,max_rounds:maxRounds,client:'test',date:'2026-10-02',hash_mode:hashMode};
 if(human)header.player_id='test_player';
 const rows=[header];let previousTurn=null;
 const game=createGame({mapNumber:1234,controllers:header.controllers.map(c=>c==='human'?'external':'bot'),humanSeat:header.human_seat,maxRounds,autoAdvanceBots:false,onDecision:event=>{
  const row={...event,controller:header.controllers[event.party]};if(row.controller==='human')row.think_ms=123;
  const turn=`${event.round}:${event.party}`;if(hashMode==='party_turn'&&turn===previousTurn)row.state_hash=null;previousTurn=turn;rows.push(row);
 }});
 while(!game.terminal){if(game.status().needsDecision)game.applyAction(game.legalMoves()[0]?.action??PASS);else game.advance();game.drainEvents();}
 rows.push({type:'result',...game.result()});return rows;
}
const text=rows=>rows.map(row=>JSON.stringify(row)).join('\n')+'\n';
test('human and bot logs replay, including sparse hashes and shards',()=>{
 const human=fixture(),bot=fixture({source:'bot',hashMode:'party_turn',maxRounds:3});bot[0].game_id='bot-test-0';
 const report=verifyLog(text([...human,...bot]));assert.deepEqual(report.map(r=>r.status),['ok','ok']);
 assert.equal(report[0].final_hash,'bbb7b81d5abaf5a3');assert.equal(report[0].ended_by,'eliminated');assert.equal(report[1].ended_by,'turn_limit');
});
test('valid prefixes are abandoned; corrupt hashes, actions and metadata fail',()=>{
 const rows=fixture();assert.equal(verifyLog(text(rows.slice(0,5)))[0].status,'abandoned');
 for(const mutate of [r=>r[1].state_hash='0'.repeat(16),r=>r[1].action=PASS,r=>r[1].n_legal++,r=>r[1].i++,r=>r[1].think_ms=-1,r=>r.at(-1).final_hash='0'.repeat(16),r=>r[0].player_id='a@example.com',r=>r[0].human_seat=2,r=>r.push(r[1]),r=>r.push(rows.at(-1)),r=>r[1].extra='unrecognized']){
  const corrupt=structuredClone(rows);mutate(corrupt);assert.throws(()=>verifyLog(text(corrupt)));
 }
 assert.throws(()=>verifyLog(text([rows[0],rows.at(-1)])),/Result before/);
 assert.throws(()=>verifyLog(text(rows)+'{bad'),/invalid JSON/);
});
