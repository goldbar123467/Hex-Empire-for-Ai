const ENCODER = new TextEncoder();

export function snapshot(board, movesLeft = 0) {
  const fields = [];
  for (let x = 0; x < 20; x++) {
    for (let y = 0; y < 11; y++) fields.push(board.field[`f${x}x${y}`]);
  }
  return {
    v: 1,
    round: board.turns,
    party: board.turn_party,
    moves_left: movesLeft,
    owner: fields.map(f => f.party),
    army_party: fields.map(f => f.army?.party ?? -1),
    army_count: fields.map(f => f.army?.count ?? 0),
    army_morale: fields.map(f => f.army?.morale ?? 0),
    army_moved: fields.map(f => Number(Boolean(f.army?.moved))),
    party_morale: [...board.hw_parties_morale],
    party_status: [...board.hw_parties_status],
    party_total_count: [...board.hw_parties_total_count],
    wfs_cell: board.hw_parties_wait_for_support_field.map(f => f ? f.fx * 11 + f.fy : -1),
    wfs_count: [...board.hw_parties_wait_for_support_count],
    duel: Number(Boolean(board.duel)),
  };
}

export function fnv1a64(bytes) {
  let hash = 0xcbf29ce484222325n;
  for (const byte of bytes) hash = BigInt.asUintN(64, (hash ^ BigInt(byte)) * 0x100000001b3n);
  return hash.toString(16).padStart(16, '0');
}

export function stateHash(state) {
  return fnv1a64(ENCODER.encode(JSON.stringify(state)));
}
