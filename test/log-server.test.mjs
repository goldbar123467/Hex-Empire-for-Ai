import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRequire} from 'node:module';
import {createGame,PASS,RULES_VERSION} from '../engine/index.js';
import {verifyLog} from '../tools/lib/verify-log.mjs';
const {createApp}=createRequire(import.meta.url)('../server.js');
test('local saves are atomic, monotonic, replay verified and path constrained',async t=>{
 const directory=await mkdtemp(join(tmpdir(),'hex-logs-'));
 const app=await createApp({logDir:directory,version:{engine_commit:'c'.repeat(40),rules_version:RULES_VERSION}});
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
 const base=`http://127.0.0.1:${server.address().port}`;
 const h={type:'header',schema_version:1,game_id:'e8d279e4-972d-41e4-876b-c51a21ddc4a0',source:'human',rules_version:RULES_VERSION,engine_commit:'c'.repeat(40),map_number:1234,map_id:1234,controllers:['human','bot','bot','bot'],human_seat:0,difficulty:5,max_rounds:1,player_id:'qa',client:'web',date:'2026-10-02',hash_mode:'every_decision'};
 const rows=[h],game=createGame({mapNumber:1234,controllers:['external','bot','bot','bot'],humanSeat:0,maxRounds:1,autoAdvanceBots:false,onDecision:e=>rows.push({...e,controller:h.controllers[e.party],...(e.party===0?{think_ms:100}:{})})});
 while(!game.terminal){if(game.status().needsDecision)game.applyAction(PASS);else game.advance();}
 rows.push({type:'result',...game.result()});
 const text=items=>items.map(row=>JSON.stringify(row)).join('\n')+'\n';
 const post=(items,extra={})=>fetch(`${base}/api/log`,{method:'POST',headers:{'Content-Type':'application/json',...extra},body:JSON.stringify({log:text(items)})});
 assert.equal((await fetch(`${base}/api/version`)).status,200);
 assert.equal((await post([h])).status,200);
 const responses=await Promise.all([post(rows),post([h])]);for(const response of responses)assert.equal(response.status,200);
 const file=join(directory,h.date,`${h.game_id}.jsonl`),saved=await readFile(file,'utf8');assert.equal(saved,text(rows));assert.equal(verifyLog(saved)[0].status,'ok');
 assert.deepEqual(await readdir(join(directory,h.date)),[`${h.game_id}.jsonl`]);
 const changed=structuredClone(rows);changed[0].player_id='someone_else';assert.equal((await post(changed)).status,409);assert.equal(await readFile(file,'utf8'),saved);
 for(const mutation of [x=>x.game_id='../escape',x=>x.date='../../',x=>x.player_id='x@y.com']){const bad=structuredClone(h);mutation(bad);assert.equal((await post([bad])).status,400);}
 assert.equal((await post(rows,{Origin:'https://example.com'})).status,403);
 const corrupt=structuredClone(rows);corrupt[0].game_id='09df565d-224a-402d-bccc-9f88c2ad3121';corrupt[1].state_hash='0'.repeat(16);assert.equal((await post(corrupt)).status,400);
 assert.equal((await post(rows)).status,200);
});
