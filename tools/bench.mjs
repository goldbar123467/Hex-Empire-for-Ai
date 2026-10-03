import os from 'node:os';
import { performance } from 'node:perf_hooks';
import { parseArgs } from 'node:util';
import { createGame } from '../engine/index.js';
import { RULES_VERSION, UPSTREAM_COMMIT } from '../engine/version.js';

const {values}=parseArgs({options:{games:{type:'string',default:'200'},legacy:{type:'boolean'},reference:{type:'boolean'},compare:{type:'boolean'}}});
if([values.legacy,values.reference,values.compare].filter(Boolean).length>1)throw new Error('Choose one of --legacy, --reference or --compare');
const count=Number(values.games);
if(!Number.isSafeInteger(count)||count<1)throw new Error('--games must be a positive integer');
const engine=mapNumber=>{const game=createGame({mapNumber});return {rounds:game.completedRounds,moves:game.decisions};};
const reference=values.legacy||values.reference||values.compare?(await import('../test/helpers/reference.mjs')).playReference:null;
const modes=values.compare?['engine','upstream-guarded']:[values.legacy?'legacy':values.reference?'upstream-guarded':'engine'];
const runners=modes.map(mode=>({mode,play:mode==='engine'?engine:map=>reference(map,{legacy:mode==='legacy'}),elapsed:0,rounds:0,moves:0}));
const originalWarn=console.warn;
try {
  console.warn=()=>{};
  for(const runner of runners)runner.play(233279); // warmups excluded
  for(let i=0;i<count;i++)for(const runner of i%2?[...runners].reverse():runners){
    const start=performance.now();let result;
    try{result=runner.play(i);}catch(cause){throw new Error(`${runner.mode} failed on map ${i}; benchmark incomplete`,{cause});}
    runner.elapsed+=performance.now()-start;runner.rounds+=result.rounds;runner.moves+=result.moves;
  }
}finally{console.warn=originalWarn;}
const results=runners.map(r=>({mode:r.mode,upstream_commit:UPSTREAM_COMMIT,rules_version:r.mode==='legacy'?'v1-upstream-8272cde':RULES_VERSION,
 node:process.version,platform:`${os.platform()} ${os.arch()}`,cpu:os.cpus()[0]?.model,logical_cpus:os.cpus().length,workers:1,games:count,
 games_per_second:count*1000/r.elapsed,ms_per_game:r.elapsed/count,mean_rounds:r.rounds/count,bot_move_points_per_game:r.moves/count}));
console.log(JSON.stringify(values.compare?{runs:results,engine_to_reference_speed:results[0].games_per_second/results[1].games_per_second,order:'alternating per map'}:results[0],null,2));
