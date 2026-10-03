import { RULES_VERSION } from '/engine/index.js';
export class GameLogger {
 constructor({mapNumber,humanSeat,playerId,engineCommit,onStatus=()=>{}}){
  this.id=crypto.randomUUID();this.onStatus=onStatus;this.savedBytes=0;this.pending=false;this.saving=false;this.finished=false;
  this.rows=[{type:'header',schema_version:1,game_id:this.id,source:'human',rules_version:RULES_VERSION,engine_commit:engineCommit,map_number:mapNumber,map_id:mapNumber%233280,
   controllers:[0,1,2,3].map(p=>p===humanSeat?'human':'bot'),human_seat:humanSeat,difficulty:5,max_rounds:150,player_id:playerId,client:'web',date:new Date().toISOString().slice(0,10),hash_mode:'every_decision'}];
 }
 consume(events,game){
  let shouldSave=false;
  for(const event of events){
   if(event.type==='decision'){
    const row={...event,controller:this.rows[0].controllers[event.party]};
    if(row.controller==='human')row.think_ms=Math.min(2147483647,game.lastThinkMs);
    this.rows.push(row);
   }else if(event.type==='round')shouldSave=true;
   else if(event.type==='terminal'&&!this.finished){this.finished=true;this.rows.push({type:'result',...game.engine.result()});shouldSave=true;}
  }
  if(shouldSave)this.save();
 }
 text(){return this.rows.map(row=>JSON.stringify(row)).join('\n')+'\n';}
 async save(){
  this.pending=true;if(this.saving)return;
  this.saving=true;
  try{
   while(this.pending){
    this.pending=false;const log=this.text();this.onStatus('saving');
    const response=await fetch('/api/log',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({log})});
    const result=await response.json();if(!response.ok)throw new Error(result.error||'Unable to save game');
    this.savedBytes=result.bytes;this.onStatus(result.verified?'verified':'saved');
   }
  }catch(error){this.onStatus('failed',error);}
  finally{this.saving=false;}
 }
 download(){
  const link=document.createElement('a'),url=URL.createObjectURL(new Blob([this.text()],{type:'application/x-ndjson'}));
  link.href=url;link.download=`${this.id}.jsonl`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
}
