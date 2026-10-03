import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createReference, playReference, withoutWarnings } from './helpers/reference.mjs';
import { snapshot, stateHash } from './helpers/snapshot.mjs';
import { UpstreamGame as Game } from './helpers/upstream.mjs';

test('reference harness matches the actual upstream Game turn methods', () => {
  withoutWarnings(() => {
    for (const mapNumber of [0, 1234, 233279]) {
      const expected = [];
      const result = playReference(mapNumber, { afterParty: board => expected.push(stateHash(snapshot(board))) });
      const actual = [];
      const context = {
        ...createReference(mapNumber), turns: 0,
        mapRender: { drawMap() {} }, statistics: { collectStatistics() {} }, replay: { captureSnapshot() {} },
        isDuel: Game.prototype.isDuel,
        runComputerTurn(map, board, party) {
          Game.prototype.runComputerTurn.call(this, map, board, party);
          actual.push(stateHash(snapshot(board)));
        },
      };
      while (!context.map.isVictory(context.board) && context.turns < 150) Game.prototype.runTurn.call(context);
      assert.equal(context.turns, result.rounds);
      assert.deepEqual(actual, expected, `upstream turn flow map ${mapNumber}`);
    }
  });
});
