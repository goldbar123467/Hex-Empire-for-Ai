// Builds a small hex-field grid with the same adjacency rules as
// Map.js#findNeighbours, for testing Pathfinder/Bot without a DOM.

const OFFSETS_EVEN = [[1, 0], [0, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
const OFFSETS_ODD = [[1, 1], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, 0]];

/**
 * @param {number} width
 * @param {number} height
 * @param {(x: number, y: number) => 'land' | 'water'} [typeFn] defaults to all-land
 */
export function buildHexGrid(width, height, typeFn = () => 'land') {
  const byKey = new Map();
  const key = (x, y) => `${x},${y}`;

  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      byKey.set(key(x, y), {
        fx: x,
        fy: y,
        type: typeFn(x, y),
        estate: undefined,
        army: null,
        party: -1,
        capital: -1,
        n_capital: [false, false, false, false],
        n_town: false,
        profitability: [0, 0, 0, 0],
      });
    }
  }

  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      const field = byKey.get(key(x, y));
      const offsets = x % 2 === 0 ? OFFSETS_EVEN : OFFSETS_ODD;
      field.neighbours = offsets.map(([dx, dy]) => byKey.get(key(x + dx, y + dy)));
    }
  }

  return {
    get: (x, y) => byKey.get(key(x, y)),
    all: () => [...byKey.values()],
  };
}
