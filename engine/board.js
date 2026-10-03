export const PARTY_COUNT = 4;
export const MAX_ARMY_SIZE = 99;

export function fieldKey(x, y) {
  return `f${x}x${y}`;
}

export function partyBoardKey(party) {
  return `pb${party}`;
}

export function emptyPartyArrays() {
  return Array.from({ length: PARTY_COUNT }, () => []);
}

export function isCornerField(x, y, board) {
  return (x === 1 && y === 1)
    || (x === board.hw_xmax - 2 && y === 1)
    || (x === board.hw_xmax - 2 && y === board.hw_ymax - 2)
    || (x === 1 && y === board.hw_ymax - 2);
}

export function fieldPixelPosition(x, y, board) {
  const px = x * (board.hw_fw / 4 * 3) + board.hw_fw / 2;
  const py = x % 2 === 0
    ? y * board.hw_fh + board.hw_fh / 2
    : y * board.hw_fh + board.hw_fh;
  return { px, py };
}

export function setIconLayout(icon, width, height, offsetX = 0, offsetY = 0) {
  icon._width = width;
  icon._height = height;
  icon._x = offsetX;
  icon._y = offsetY;
}

export function compareArmiesByProfitability(a, b) {
  if (a.profitability !== b.profitability) {
    return b.profitability - a.profitability;
  }
  return (b.count + b.morale) - (a.count + a.morale);
}

export function createBoard() {
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
