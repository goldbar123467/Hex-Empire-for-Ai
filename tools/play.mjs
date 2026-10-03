import { parseArgs } from 'node:util';
import { createGame, PASS, RULES_VERSION } from '../engine/index.js';
const {values}=parseArgs({options:{map:{type:'string',default:'1234'},controllers:{type:'string',default:'bot,bot,bot,bot'},'human-seat':{type:'string',default:'-1'},'max-rounds':{type:'string',default:'150'}}});
const game=createGame({mapNumber:Number(values.map),controllers:values.controllers.split(','),humanSeat:Number(values['human-seat']),maxRounds:Number(values['max-rounds'])});
// This CLI has no interactive input: external seats use the deterministic first-legal baseline.
while(!game.terminal)game.applyAction(game.legalMoves()[0]?.action ?? PASS);
console.log(JSON.stringify({map_number:game.options.mapNumber,rules_version:RULES_VERSION,external_policy:'first-legal',decisions:game.decisions,...game.result()},null,2));
