import { createGame } from '/engine/index.js';
import { MapRender } from './MapRender.js';
import { Statistics } from './Statistics.js';
import { Replay } from './Replay.js';
import { updateStatusBar, beginTurnSection, onMapReady, resetGameLog } from './UI.js';

// Browser adapter: all turn progression belongs to engine/Game.
export class Game {
  constructor() {
    this.mapRender = new MapRender();
    this.statistics = new Statistics();
    this.replay = new Replay();
    this.images = {};
    const assets = {city:'city',port:'port',capital0:'capital_red',capital1:'capital_violet',capital2:'capital_blue',capital3:'capital_green'};
    for (const [prefix,letter] of [['grassBg','l'],['seaBg','m'],['townBgGrass','c']]) {
      for(let i=1;i<=6;i++) assets[`${prefix}${i}`]=`${letter}_${i}`;
    }
    this.assetsReady = Promise.all(Object.entries(assets).map(([key,name])=>new Promise((resolve,reject)=>{
      const img = new Image(); this.images[key]={img};
      img.onload=resolve;img.onerror=()=>reject(new Error(`Unable to load ${name}`));img.src=`/images/${name}.png`;
    })));
    this.turns=0;
    this.generation=0;
  }

  generateRandomMap() { return this.generateNewMap(Math.floor(Math.random()*233280)); }
  async generateNewMap(mapNumber) {
    const generation=++this.generation;
    document.getElementById('startBattleButton').disabled=true;
    await this.assetsReady;
    if(generation!==this.generation)return;
    this.statistics.reset();this.replay.reset();resetGameLog();
    this.mapNumber=mapNumber;this.turns=0;
    this.engine=createGame({mapNumber,autoAdvanceBots:false,events:true});
    this.board=this.engine.board;
    this.mapRender.prepareBackground(this.board,this.images);
    this.mapRender.drawMap(this.board,this.images);
    this.replay.initialize(this.mapRender,this.images);
    this.statistics.collectStatistics(this.board,0);
    this.replay.captureSnapshot(this.board,0);
    updateStatusBar(mapNumber,1);onMapReady(mapNumber);
  }
  isVictory() { return this.engine?.terminal ?? false; }
  runTurn() {
    const round=this.engine.completedRounds;
    const container=beginTurnSection(round+1);
    do { this.engine.advance(); } while(!this.engine.terminal && this.engine.completedRounds===round);
    for(const event of this.engine.drainEvents()) if(event.message && container) {
      const entry=document.createElement('div');entry.className=`log-entry log-${event.type}`;entry.textContent=event.message;container.append(entry);
    }
    this.turns=this.engine.completedRounds;
    this.statistics.collectStatistics(this.board,this.turns);
    this.replay.captureSnapshot(this.board,this.turns);
    this.mapRender.drawMap(this.board,this.images);
    updateStatusBar(this.mapNumber,this.turns);
  }
}
