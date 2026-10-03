import { Game } from './Game.js'
import { initializeUI } from './UI.js'

const MAX_MAP_NUMBER_DIGITS = 6;

/** Sanitizes free-text map # input into an integer, picking a random map number when left blank. */
function parseMapNumberInput(rawValue) {
  const digitsOnly = rawValue.replace(/\D/g, '').substring(0, MAX_MAP_NUMBER_DIGITS);
  if (digitsOnly === "") {
    return Math.floor(Math.random() * 999999);
  }
  return parseInt(digitsOnly, 10);
}

$(function(){
  const game = new Game();
  window.game = game; // Make game accessible for replay controls
  game.generateRandomMap();
  
  // Initialize UI handlers
  initializeUI();

  var mapNumberInput = document.getElementById('mapNumberInput');
  var changeMapButton = document.getElementById('changeMapButton');
  changeMapButton.onclick = function() {
    game.generateNewMap(parseMapNumberInput(mapNumberInput.value));
  };

  var randomMapButton = document.getElementById('randomMapButton');
  randomMapButton.onclick = function() {
    game.generateRandomMap();
  };

  var startBattleButton = document.getElementById('startBattleButton');
  startBattleButton.disabled = true; // Disable until map is loaded
  startBattleButton.onclick = function() {
    if (game.isVictory()) {
      // Reset map
      game.generateNewMap(game.mapNumber);
    }

    mapNumberInput.value = game.mapNumber;
    mapNumberInput.disabled = true;
    changeMapButton.disabled = true;
    randomMapButton.disabled = true;
    startBattleButton.disabled = true;

    const maxTurnLimit = 150;
    var intervalId = setInterval(function(){
      game.runTurn();

      if (game.isVictory() || game.turns >= maxTurnLimit) {
        mapNumberInput.disabled = false;
        changeMapButton.disabled = false;
        randomMapButton.disabled = false;
        startBattleButton.disabled = false;

        // Enable replay after game ends
        game.replay.enable(game.board);

        clearInterval(intervalId);
      }
    }, 1000);
  };

});
