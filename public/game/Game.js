import { createGame } from '/engine/index.js';
import { MapRender } from './MapRender.js';
import { Replay } from './Replay.js';

// Browser pacing and presentation only; all game transitions live in engine/.
export class Game {
  constructor({onChange=()=>{},onEvents=()=>{}}={}) {
    this.onChange=onChange;this.onEvents=onEvents;
    this.mapRender=new MapRender();this.mapRender.showTownNames=false;
    this.replay=new Replay();this.images={};this.generation=0;this.botSpeed=150;
    const assets={city:'city',port:'port',capital0:'capital_red',capital1:'capital_violet',capital2:'capital_blue',capital3:'capital_green'};
    for(const [prefix,letter] of [['grassBg','l'],['seaBg','m'],['townBgGrass','c']])for(let i=1;i<=6;i++)assets[`${prefix}${i}`]=`${letter}_${i}`;
    this.assetsReady=Promise.all(Object.entries(assets).map(([key,name])=>new Promise((resolve,reject)=>{
      const img=new Image();this.images[key]={img};img.onload=resolve;img.onerror=()=>reject(new Error(`Unable to load ${name}`));img.src=`/images/${name}.png`;
    })));
  }
  async start(options,{preview=false}={}) {
    const generation=++this.generation;clearTimeout(this.timer);
    await this.assetsReady;if(generation!==this.generation)return;
    this.replay.reset();this.preview=preview;this.selected=null;this.thinkStarted=null;
    this.engine=createGame({...options,autoAdvanceBots:false,recordDecisions:!preview,events:true,
      onPartyTurn:g=>{if(g.board.turn_party===3)this.replay.captureSnapshot(g.board,g.completedRounds+1);}});
    this.board=this.engine.board;this.mapNumber=options.mapNumber;
    this.mapRender.prepareBackground(this.board,this.images);
    this.replay.initialize(this.mapRender,this.images);this.replay.captureSnapshot(this.board,0);
    this.updated();
  }
  updated() {
    const events=this.engine.drainEvents();
    if(events.some(e=>e.type==='terminal') && this.replay.snapshots.at(-1)?.turn!==this.engine.result().rounds)this.replay.captureSnapshot(this.board,this.engine.result().rounds);
    this.onEvents(events,this);
    this.selected=null;
    this.thinkStarted=this.engine.status().needsDecision?performance.now():null;
    this.render();this.onChange(this);
  }
  render() {
    this.mapRender.drawMap(this.board,this.images);
    if(!this.preview && this.engine.status().needsDecision)this.mapRender.drawLegalMoves(this.board,this.engine.legalMoves(),this.selected);
  }
  playAction(action) {
    this.lastThinkMs=Math.max(0,Math.round(performance.now()-this.thinkStarted));
    this.engine.applyAction(action);this.updated();this.queueBot();
  }
  queueBot() {
    clearTimeout(this.timer);
    if(this.preview || !this.engine.status().botPending)return;
    this.timer=setTimeout(()=>{
      try {this.engine.advance();this.updated();this.queueBot();}
      catch(error){this.onError?.(error);}
    },this.botSpeed);
  }
  stop(){clearTimeout(this.timer);this.generation++;this.preview=true;}
}
