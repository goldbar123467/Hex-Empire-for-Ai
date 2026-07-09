import { Map } from './Map.js'
import { MapRender } from './MapRender.js'
import { Statistics } from './Statistics.js'
import { Replay } from './Replay.js'
import { updateStatusBar, beginTurnSection, onMapReady } from './UI.js'

const PARTY_COUNT = 4;

/** Four fresh empty arrays (one per party) for board party-scoped lists. */
function emptyPartyArrays() {
  return Array.from({ length: PARTY_COUNT }, () => []);
}

class Game {
  constructor() {
    this.mapRender = new MapRender();
    this.images = this.prepareImages();
    this.turns = 0;
    this.statistics = new Statistics();
    this.replay = new Replay();
  }

  prepareImages() {
    const imageRef = (path) => ({ img: null, path, status: 'none' });
    const images = {};

    const numberedVariants = [
      ['grassBg', 'l'],
      ['seaBg', 'm'],
      ['townBgGrass', 'c']
    ];
    for (const [prefix, letter] of numberedVariants) {
      for (let i = 1; i <= 6; i++) {
        images[`${prefix}${i}`] = imageRef(`images/${letter}_${i}.png`);
      }
    }

    images.city = imageRef('images/city.png');
    images.port = imageRef('images/port.png');
    images.capital0 = imageRef('images/capital_red.png');
    images.capital1 = imageRef('images/capital_violet.png');
    images.capital2 = imageRef('images/capital_blue.png');
    images.capital3 = imageRef('images/capital_green.png');
    return images;
  }

  generateNewBoard() {
    return {
      hw_init: false,
      hw_xmax: 20,
      hw_ymax: 11,
      hw_fw: 50,
      hw_fh: 40,
      hw_land: 0,
      hw_top_field_depth: 0,
      hw_lands: [],
      hw_towns: [],
      hw_parties_capitals: [],
      hw_parties_count: PARTY_COUNT,
      hw_parties_names: ["Redosia", "Violetnam", "Bluegaria", "Greenland"],
      hw_parties_provinces_cp: emptyPartyArrays(),
      hw_parties_towns: emptyPartyArrays(),
      hw_parties_ports: emptyPartyArrays(),
      hw_parties_lands: emptyPartyArrays(),
      hw_parties_morale: [10, 10, 10, 10],
      hw_parties_armies: emptyPartyArrays(),
      hw_parties_status: [1, 1, 1, 1],
      hw_parties_total_count: [0, 0, 0, 0],
      hw_parties_total_power: [0, 0, 0, 0],
      hw_parties_control: ["computer", "computer", "computer", "computer"],
      hw_parties_wait_for_support_field: [null, null, null, null],
      hw_parties_wait_for_support_count: [0, 0, 0, 0],
      hw_parties_speech_given: [false, false, false, false],
      hw_pact_signed: false,
      hw_pact_just_broken: -1,
      hw_peace: -1,
      hw_lAID: 0,
      hw_aTL: 0,
      lh_area: 0,
      human: -1,
      human_condition: 1,
      turns: 0,
      wait: 0,
      turn_party: 0,
      difficulty: 5,
      duel: false,
      field: {},
      armies: {},
      renderOffset: { x: 10, y: 10 },
    };
  }

  generateRandomMap() {
    this.generateNewMap(Math.floor(Math.random() * 999999));
  }

  loadImage(ref) {
    return new Promise((resolve) => {
      ref.img = new Image();
      ref.img.onload = () => { ref.status = 'Image loaded'; resolve(); };
      ref.img.onerror = () => { ref.status = 'Failed to load image'; resolve(); };
      ref.img.src = ref.path;
    });
  }

  generateNewMap(mapNumber) {
    this.mapNumber = mapNumber;
    this.statistics.reset();
    this.replay.reset();

    this.board = this.generateNewBoard();
    this.map = new Map(this.mapNumber, this.images);

    const imageLoads = Object.values(this.images).map((ref) => this.loadImage(ref));

    Promise.all(imageLoads).then(() => {
      this.map.generateMap(this.board);
      this.mapRender.drawInitialBackground(this.board);
      this.map.updateBoard(this.board);
      this.map.calcAIHelpers(this.board);
      this.initGame();

      updateStatusBar(this.map.mapNumber, this.turns + 1);
      onMapReady(this.map.mapNumber);
    });
  }

  initGame() {
    const { board, map } = this;
    for (let party = 0; party < board.hw_parties_count; party++) {
      map.unitsSpawn(party, board);
      map.updateBoard(board);
    }
    this.mapRender.drawMap(board, this.images);
    this.turns = 0;

    this.replay.initialize(this.mapRender, this.images);
    this.statistics.collectStatistics(board, this.turns + 1);
    this.replay.captureSnapshot(board, 0);
  }

  isVictory() {
    return this.map.isVictory(this.board);
  }

  runTurn() {
    const { board, map } = this;
    board.turns = this.turns;

    updateStatusBar(map.mapNumber, this.turns + 1);
    map.setTurnLogContainer(beginTurnSection(this.turns + 1));

    for (let turnParty = 0; turnParty < board.hw_parties_count; turnParty++) {
      this.runComputerTurn(map, board, turnParty);
    }

    this.statistics.collectStatistics(board, this.turns + 1);
    this.replay.captureSnapshot(board, this.turns + 1);
    this.turns++;
  }

  runComputerTurn(map, board, turnParty) {
    board.turn_party = turnParty;
    board.duel = this.isDuel(board);

    const movePoints = map.getMovePoints(turnParty, board);
    map.cleanupTurn(board);
    map.updateBoard(board);

    if (board.hw_parties_control[turnParty] !== "computer") {
      this.mapRender.drawMap(board, this.images);
      return;
    }

    for (let i = 0; i < movePoints; i++) {
      map.makeMove(turnParty, board);
      map.updateArmies(board);
    }
    map.unitsSpawn(turnParty, board);
    this.mapRender.drawMap(board, this.images);
  }

  isDuel(board) {
    let survivingCapitals = 0;
    for (let i = 0; i < PARTY_COUNT; i++) {
      if (board.hw_parties_capitals[i].party === i) {
        survivingCapitals++;
      }
    }
    return survivingCapitals < 3;
  }
}

export { Game }
