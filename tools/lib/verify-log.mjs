import { createGame, RULES_VERSION } from '../../engine/index.js';

function requireThat(condition,message){if(!condition)throw new Error(message);}
function same(actual,expected,name){requireThat(JSON.stringify(actual)===JSON.stringify(expected),`${name}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);}
const int=(v,min,max)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
const fields={
 header:['type','schema_version','game_id','source','rules_version','engine_commit','map_number','map_id','controllers','human_seat','difficulty','max_rounds','player_id','client','date','hash_mode'],
 decision:['type','i','round','party','controller','moves_left','state_hash','action','from','to','n_legal','think_ms','noop'],
 result:['type','rounds','winner','ended_by','external_outcome','final_hash']
};
export function parseLog(text){
 requireThat(typeof text==='string' && text.length>0,'Empty log');
 const lines=text.replace(/\r\n/g,'\n').split('\n');if(lines.at(-1)==='')lines.pop();
 return lines.map((line,index)=>{
  let row;try{row=JSON.parse(line);}catch{throw new Error(`Line ${index+1}: invalid JSON`);}
  requireThat(row && !Array.isArray(row) && Object.hasOwn(fields,row.type),`Line ${index+1}: unknown record type`);
  requireThat(Object.keys(row).every(key=>fields[row.type].includes(key)),`Line ${index+1}: unknown field`);
  return row;
 });
}
export function validateHeader(h){
 requireThat(h?.type==='header' && h.schema_version===1,'Unsupported log schema');
 requireThat(h.rules_version===RULES_VERSION,'Unsupported rules version');
 requireThat(typeof h.game_id==='string' && /^[A-Za-z0-9_-]{1,128}$/.test(h.game_id),'Invalid game id');
 requireThat(['human','bot','agent'].includes(h.source),'Invalid source');
 requireThat(/^[0-9a-f]{7,40}(?:-dirty)?$/.test(h.engine_commit),'Invalid engine commit');
 requireThat(int(h.map_number,0,2147483647) && h.map_id===h.map_number%233280,'Invalid map number/id');
 requireThat(Array.isArray(h.controllers) && h.controllers.length===4 && h.controllers.every(c=>typeof c==='string'&&(c==='bot'||c==='human'||/^agent:[A-Za-z0-9_.\/-]{1,64}$/.test(c))),'Invalid controllers');
 requireThat(int(h.human_seat,-1,3) && h.difficulty===5 && int(h.max_rounds,1,150),'Invalid game settings');
 requireThat(['every_decision','party_turn'].includes(h.hash_mode),'Invalid hash mode');
 requireThat(typeof h.client==='string' && /^[A-Za-z0-9_-]{1,32}$/.test(h.client),'Invalid client');
 requireThat(typeof h.date==='string' && /^\d{4}-\d{2}-\d{2}$/.test(h.date) && !Number.isNaN(Date.parse(h.date)) && new Date(h.date).toISOString().slice(0,10)===h.date,'Invalid UTC date');
 if(h.source==='human'){
  requireThat(typeof h.player_id==='string' && /^[A-Za-z0-9_-]{1,32}$/.test(h.player_id),'Invalid player pseudonym');
  requireThat(h.controllers.filter(c=>c==='human').length===1 && h.controllers[h.human_seat]==='human','Human seat/controller mismatch');
 }else {
  requireThat(h.player_id===undefined && !h.controllers.includes('human'),'Only human games include a player');
  requireThat(h.source==='bot'?h.controllers.every(c=>c==='bot'):h.controllers.some(c=>c.startsWith('agent:')),'Source/controller mismatch');
 }
 return h;
}

// Throws on any corrupt prefix; a missing footer is valid but explicitly abandoned.
export function verifyLog(text){
 const rows=parseLog(text),reports=[],seenIds=new Set();
 let game=null,header=null,observed=null,previousTurn=null,count=0;
 const abandoned=()=>{if(game)reports.push({game_id:header.game_id,status:'abandoned',decisions:count});};
 const originalWarn=console.warn;
 try{
  console.warn=()=>{};
  for(let index=0;index<rows.length;index++){
   const row=rows[index];
   try{
    if(row.type==='header'){
     abandoned();validateHeader(row);requireThat(!seenIds.has(row.game_id),'Duplicate game id');seenIds.add(row.game_id);
     header=row;count=0;previousTurn=null;
     game=createGame({mapNumber:row.map_number,controllers:row.controllers.map(c=>c==='bot'?'bot':'external'),humanSeat:row.human_seat,difficulty:row.difficulty,maxRounds:row.max_rounds,autoAdvanceBots:false,events:false,onDecision:event=>{observed=event;}});
    }else if(row.type==='decision'){
     requireThat(game && !game.terminal,'Decision without a pending game');
     const status=game.status(),controller=header.controllers[status.party],turn=`${status.round}:${status.party}`;
     requireThat(row.controller===controller,'Controller mismatch');
     const needsHash=header.hash_mode==='every_decision'||turn!==previousTurn;
     requireThat(needsHash?/^[0-9a-f]{16}$/.test(row.state_hash):row.state_hash===null||/^[0-9a-f]{16}$/.test(row.state_hash),'Missing or invalid decision hash');
     if(row.state_hash!==null)same(row.state_hash,game.hash(),'state_hash');
     if(controller==='human')requireThat(int(row.think_ms,0,2147483647),'Invalid human think_ms');
     else requireThat(row.think_ms===undefined,'think_ms belongs only to human decisions');
     observed=null;
     if(controller==='bot')game.advance();else game.applyAction(row.action);
     requireThat(observed,'Missing engine decision');
     for(const key of ['i','round','party','moves_left','action','from','to','n_legal'])same(row[key],observed[key],key);
     same(row.noop===true,observed.noop===true,'noop');
     game.drainEvents();previousTurn=turn;count++;
    }else{
     requireThat(game?.terminal,'Result before the engine terminated');
     const result=game.result();for(const key of Object.keys(result))same(row[key],result[key],key);
     reports.push({game_id:header.game_id,status:'ok',decisions:count,...result});game=null;header=null;
    }
   }catch(error){throw new Error(`Line ${index+1}: ${error.message}`,{cause:error});}
  }
  abandoned();requireThat(reports.length>0,'No games in log');return reports;
 }finally{console.warn=originalWarn;}
}
