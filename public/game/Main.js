import { Game } from './Game.js';
import { PASS } from '/engine/index.js';
const $=id=>document.getElementById(id);
const names=['Redosia','Violetnam','Bluegaria','Greenland'];
const colors=['#e57268','#b299de','#78b4d8','#96b67b'];
const game=new Game({onChange:update,onEvents:consumeEvents});
window.game=game;
let active=false,seat=0,dispatchCount=0;
function showError(error){$('appError').textContent=error.message ?? String(error);$('appError').hidden=false;}
game.onError=showError;
try{$('playerId').value=localStorage.getItem('hex-player-id')||'p01';}catch{}
function mapNumber(){const input=$('mapNumberInput');return input.value===''?Math.floor(Math.random()*233280):Number(input.value);}
function consumeEvents(events){
  for(const event of events)if(event.message){const li=document.createElement('li');li.textContent=`Round ${event.round+1} · ${event.message}`;$('gamelog').prepend(li);dispatchCount++;}
  while($('gamelog').children.length>180)$('gamelog').lastChild.remove();
  $('logBadge').textContent=dispatchCount;
}
function update(){
  if(!game.engine)return;
  const status=game.engine.status(),human=status.needsDecision && !game.preview;
  $('mapNumberStatus').textContent=game.mapNumber;
  $('turnStatus').textContent=game.preview?'Ready to begin':`Round ${Math.min(150,status.round+1)} / 150`;
  $('movesLeft').textContent=human?status.movesLeft:'—';
  $('endTurnButton').disabled=!human;
  $('map').classList.toggle('actionable',human);
  $('turnDot').style.background=colors[status.party];
  $('turnHeading').textContent=status.terminal?'Campaign complete':human?'Your turn':`${names[status.party]} is moving`;
  $('turnDetail').textContent=human?'Select a bright-ringed army, then its destination.':status.terminal?'Review the map or start another campaign.':'Your opponents are taking their turns.';
  $('mapHint').textContent=game.preview?'Choose a seat and start your campaign.':human?'Select an army → choose a highlighted hex.':status.terminal?'Campaign complete.':'Opponents moving…';
  const stats=names.map(()=>({troops:0,land:0}));
  for(const f of Object.values(game.board.field)){if(f.party>=0 && f.type==='land')stats[f.party].land++;if(f.army)stats[f.army.party].troops+=f.army.count;}
  $('empireStats').replaceChildren(...names.map((name,p)=>{
    const card=document.createElement('div');card.className='empire'+(game.board.hw_parties_status[p]===0?' fallen':'');card.style.setProperty('--empire',colors[p]);
    card.innerHTML=`<div class="empire-name"><i></i>${name}${active&&seat===p?' · you':''}</div><div class="empire-numbers"><b>${stats[p].troops}</b> troops · ${stats[p].land} land</div>`;
    return card;
  }));
  $('selectionTitle').textContent=human?'Choose an army':status.terminal?'Final battlefield':'Awaiting your turn';
  $('selectionDetail').textContent=human?'Bright rings mark armies that can move.':'Army labels show troops / morale.';
  if(status.terminal && active){
    $('resultPanel').hidden=false;
    const result=game.engine.result();
    $('resultHeading').textContent=result.ended_by==='eliminated'?'Your empire fell.':result.winner>=0?`${names[result.winner]} wins.`:'The campaign has ended.';
    $('resultDetail').textContent=`${result.rounds} rounds played. ${result.ended_by==='turn_limit'?'The 150-round limit was reached.':result.ended_by==='eliminated'?'Your capital was lost.':'All opposing capitals have been captured.'}`;
    $('replayBar').hidden=false;$('replaySlider').max=game.replay.snapshots.length-1;$('replaySlider').value=game.replay.snapshots.length-1;$('replayLabel').textContent=`Round ${result.rounds}`;
  }
}
async function start(watch=false){
  if(!$('setupForm').reportValidity())return;
  $('appError').hidden=true;$('startBattleButton').disabled=true;$('watchButton').disabled=true;
  seat=watch?-1:Number(document.querySelector('input[name=seat]:checked').value);
  try{localStorage.setItem('hex-player-id',$('playerId').value);}catch{}
  const controllers=names.map((_,p)=>p===seat?'external':'bot');
  $('gamelog').replaceChildren();dispatchCount=0;$('resultPanel').hidden=true;$('replayBar').hidden=true;
  active=true;
  try{
    await game.start({mapNumber:mapNumber(),controllers,humanSeat:seat});
    $('setupPanel').hidden=true;$('activePanel').hidden=false;
    $('empireTitle').textContent=seat<0?'A battle of empires.':names[seat];$('campaignLabel').textContent=seat<0?'SPECTATOR MODE':'YOUR CAMPAIGN';
    game.queueBot();
  }catch(error){active=false;showError(error);$('startBattleButton').disabled=false;$('watchButton').disabled=false;}
}
$('setupForm').addEventListener('submit',event=>{event.preventDefault();start();});
$('watchButton').addEventListener('click',()=>start(true));
$('randomMapButton').addEventListener('click',async()=>{
  $('mapNumberInput').value=Math.floor(Math.random()*233280);
  try{await game.start({mapNumber:mapNumber()},{preview:true});}catch(error){showError(error);}
});
$('mapNumberInput').addEventListener('change',async()=>{if($('mapNumberInput').checkValidity())try{await game.start({mapNumber:mapNumber()},{preview:true});}catch(error){showError(error);}});
$('botSpeed').addEventListener('input',()=>{game.botSpeed=Number($('botSpeed').value);$('speedValue').textContent=`${game.botSpeed} ms`;});
$('showNames').addEventListener('change',()=>{game.mapRender.showTownNames=$('showNames').checked;game.render();});
$('newGameButton').addEventListener('click',async()=>{
  if(!game.engine.terminal && !confirm('Leave this campaign and set up a new one?'))return;
  game.stop();active=false;$('activePanel').hidden=true;$('setupPanel').hidden=false;$('replayBar').hidden=true;
  $('startBattleButton').disabled=false;$('watchButton').disabled=false;
  await game.start({mapNumber:game.mapNumber},{preview:true});
});
$('replaySlider').addEventListener('input',()=>{const index=Number($('replaySlider').value);game.replay.goToTurn(index,game.board);$('replayLabel').textContent=`Round ${game.replay.snapshots[index].turn}`;});
$('replayExit').addEventListener('click',()=>{game.render();$('replaySlider').value=game.replay.snapshots.length-1;$('replayLabel').textContent=`Round ${game.engine.result().rounds}`;});
try{await game.start({mapNumber:1234},{preview:true});$('startBattleButton').disabled=false;$('watchButton').disabled=false;}catch(error){showError(error);}
