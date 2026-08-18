// Regression coverage for "Fix map-generation determinism regression from
// dropped rand() call": every rand() call is part of one seeded sequence, so
// adding/dropping/reordering any of them reshuffles all maps generated after.
import { before, test } from 'node:test';
import assert from 'node:assert/strict';
import { installDomStub, buildFakeImages } from './helpers/domStub.mjs';

before(() => installDomStub());
const { Map } = await import('../public/game/Map.js');

const PARTY_COUNT = 4;

// Mirrors Game.js#generateNewBoard, kept independent so this test doesn't
// pull in MapRender/Replay/Statistics and their own DOM/canvas requirements.
function makeBoard() {
  const emptyPartyArrays = () => Array.from({ length: PARTY_COUNT }, () => []);
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
    hw_parties_names: ['Redosia', 'Violetnam', 'Bluegaria', 'Greenland'],
    hw_parties_provinces_cp: emptyPartyArrays(),
    hw_parties_towns: emptyPartyArrays(),
    hw_parties_ports: emptyPartyArrays(),
    hw_parties_lands: emptyPartyArrays(),
    hw_parties_morale: [10, 10, 10, 10],
    hw_parties_armies: emptyPartyArrays(),
    hw_parties_status: [1, 1, 1, 1],
    hw_parties_total_count: [0, 0, 0, 0],
    hw_parties_total_power: [0, 0, 0, 0],
    hw_parties_control: ['computer', 'computer', 'computer', 'computer'],
    hw_parties_wait_for_support_field: [null, null, null, null],
    hw_parties_wait_for_support_count: [0, 0, 0, 0],
    hw_pact_signed: false,
    hw_pact_just_broken: -1,
    hw_peace: -1,
    hw_lAID: 0,
    hw_aTL: 0,
    human: -1,
    turns: 0,
    turn_party: 0,
    difficulty: 5,
    duel: false,
    field: {},
    armies: {},
    renderOffset: { x: 10, y: 10 },
  };
}

/** Flattens the per-field data that should be identical between two generations of the same map number. */
function snapshotBoard(board) {
  const fields = [];
  for (let x = 0; x < board.hw_xmax; x++) {
    for (let y = 0; y < board.hw_ymax; y++) {
      const field = board.field[`f${x}x${y}`];
      fields.push({
        x,
        y,
        type: field.type,
        estate: field.estate ?? null,
        capital: field.capital,
        party: field.party,
        town_name: field.town_name ?? null,
      });
    }
  }
  return fields;
}

function generate(mapNumber) {
  const board = makeBoard();
  const map = new Map(mapNumber, buildFakeImages());
  map.generateMap(board);
  return snapshotBoard(board);
}

test('generating the same map number twice yields an identical map', () => {
  assert.deepEqual(generate(555), generate(555));
});

test('generating different map numbers yields different maps', () => {
  assert.notDeepEqual(generate(1), generate(2));
});
