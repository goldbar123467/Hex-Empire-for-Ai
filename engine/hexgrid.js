export const WIDTH = 20;
export const HEIGHT = 11;
export const CELLS = WIDTH * HEIGHT;
export const PASS = 3960;
export const NUM_ACTIONS = PASS + 1;
export const cellIndex = (x, y) => x * HEIGHT + y;
export const cellXY = i => [Math.floor(i / HEIGHT), i % HEIGHT];
export const oddQToAxial = (x, y) => [x, y - (x - (x & 1)) / 2];
export const axialToOddQ = (q, r) => [q, r + (q - (q & 1)) / 2];
export const hexDistance = (dq, dr) => Math.max(Math.abs(dq), Math.abs(dr), Math.abs(dq + dr));
export const offsets = [];
for (let dq = -2; dq <= 2; dq++) {
  for (let dr = -2; dr <= 2; dr++) {
    if (hexDistance(dq, dr) >= 1 && hexDistance(dq, dr) <= 2) offsets.push(Object.freeze({ dq, dr }));
  }
}
Object.freeze(offsets);
export const cells = Object.freeze(Array.from({ length: CELLS }, (_, i) => {
  const [x, y] = cellXY(i);
  const [q, r] = oddQToAxial(x, y);
  return Object.freeze({ x, y, q, r });
}));

export function encodeAction(from, to) {
  if (from === null && to === null) return PASS;
  if (!Array.isArray(from) || !Array.isArray(to) || from.length !== 2 || to.length !== 2 || ![...from, ...to].every(Number.isInteger)) throw new TypeError('Expected integer coordinate pairs');
  if (from[0] < 0 || from[0] >= WIDTH || from[1] < 0 || from[1] >= HEIGHT) throw new RangeError('Origin outside board');
  const [q, r] = oddQToAxial(...from);
  const [tq, tr] = oddQToAxial(...to);
  const k = offsets.findIndex(o => o.dq === tq - q && o.dr === tr - r);
  if (k < 0) throw new RangeError('Action destination must be at hex distance 1 or 2');
  return cellIndex(...from) * 18 + k;
}

export function decodeAction(action) {
  if (!Number.isInteger(action) || action < 0 || action >= NUM_ACTIONS) throw new RangeError('Invalid action id');
  if (action === PASS) return { from: null, to: null };
  const cell = cells[Math.floor(action / 18)];
  const offset = offsets[action % 18];
  return { from: [cell.x, cell.y], to: axialToOddQ(cell.q + offset.dq, cell.r + offset.dr) };
}

export const hexgrid = Object.freeze({ cells, offsets, num_actions: NUM_ACTIONS, pass_action: PASS });
