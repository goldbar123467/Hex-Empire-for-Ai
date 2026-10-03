import { installDomStub, buildFakeImages } from './domStub.mjs';

installDomStub();
const { Map } = await import('../../public/game/Map.js');
const { Game } = await import('../../public/game/Game.js');
const { UpstreamMap, UpstreamGame } = await import('./upstream.mjs');

export const UPSTREAM_COMMIT = '8272cde7fce46520cffc3c845ed3f83ff95ead0a';

export function createReference(mapNumber, { legacy = false } = {}) {
  const board = UpstreamGame.prototype.generateNewBoard();
  const MapClass = legacy ? UpstreamMap : Map;
  const map = new MapClass(mapNumber, buildFakeImages());
  map.generateMap(board);
  map.updateBoard(board);
  map.calcAIHelpers(board);
  for (let party = 0; party < 4; party++) {
    map.unitsSpawn(party, board);
    map.updateBoard(board);
  }
  return { map, board };
}

export function withoutWarnings(fn) {
  const original = console.warn;
  console.warn = () => {};
  try { return fn(); } finally { console.warn = original; }
}

// Mirrors the pinned Game.runTurn/runComputerTurn, with rendering omitted.
export function playReference(mapNumber, { afterSetup, afterParty, maxRounds = 150, legacy = false } = {}) {
  return withoutWarnings(() => {
    const { map, board } = createReference(mapNumber, { legacy });
    afterSetup?.(board);
    let rounds = 0;
    let moves = 0;
    do {
      board.turns = rounds;
      for (let party = 0; party < 4; party++) {
        board.turn_party = party;
        board.duel = Game.prototype.isDuel(board);
        const movePoints = map.getMovePoints(party, board);
        map.cleanupTurn(board);
        map.updateBoard(board);
        for (let i = 0; i < movePoints; i++) {
          map.makeMove(party, board);
          map.updateArmies(board);
          moves++;
        }
        map.unitsSpawn(party, board);
        afterParty?.(board);
      }
      rounds++;
    } while (!map.isVictory(board) && rounds < maxRounds);
    const winner = board.hw_parties_provinces_cp.findIndex(cp => cp?.length === 3);
    return { rounds, winner, moves, board, map };
  });
}
