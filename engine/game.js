import { Rules } from './rules.js';
import { createBoard } from './board.js';
import { snapshot, stateHash } from './snapshot.js';
import { PASS, cells, encodeAction, decodeAction } from './hexgrid.js';

export class Game {
  constructor(options = {}) {
    const { mapNumber = 0, controllers = ['bot','bot','bot','bot'], humanSeat = -1,
      difficulty = 5, maxRounds = 150, focusSeat = controllers.indexOf('external') >= 0 ? controllers.indexOf('external') : humanSeat,
      stopOnFocusElimination = true, autoAdvanceBots = true, recordDecisions = false } = options;
    if (controllers.length !== 4 || !controllers.every(c => c === 'bot' || c === 'external')) throw new TypeError('Expected four bot/external controllers');
    if (![humanSeat, focusSeat].every(s => Number.isInteger(s) && s >= -1 && s <= 3)) throw new RangeError('Invalid seat');
    if (difficulty !== 5) throw new RangeError('Rules v1.1 supports difficulty 5');
    if (!Number.isInteger(maxRounds) || maxRounds < 1 || maxRounds > 150) throw new RangeError('maxRounds must be 1-150');
    this.options = { mapNumber, controllers: [...controllers], humanSeat, difficulty, maxRounds, focusSeat, stopOnFocusElimination, autoAdvanceBots, recordDecisions };
    this.controllers = [...controllers];
    this.map = new Rules(mapNumber);
    this.board = createBoard();
    this.board.human = humanSeat;
    if (humanSeat >= 0) this.board.hw_parties_control[humanSeat] = 'human';
    this.board.difficulty = difficulty;
    this.map.captureEvents = options.events ?? recordDecisions;
    this.map.generateMap(this.board);
    this.map.updateBoard(this.board);
    this.map.calcAIHelpers(this.board);
    for (let p = 0; p < 4; p++) { this.map.unitsSpawn(p, this.board); this.map.updateBoard(this.board); }
    this.movesLeft = 0;
    this.nextParty = 0;
    this.completedRounds = 0;
    this.phase = 'begin';
    this.terminal = false;
    this.winner = -1;
    this.endedBy = null;
    this.decisions = 0;
    this.events = [];
    this.onPartyTurn = options.onPartyTurn;
    this.onDecision = options.onDecision;
    this.onSetup = options.onSetup;
    this.onSetup?.(this);
    if (!options.deferStart) this._advance();
  }

  status() {
    return { round: this.board.turns, party: this.board.turn_party, movesLeft: this.movesLeft,
      needsDecision: !this.terminal && this.phase === 'moves' && this.movesLeft > 0 && this.controllers[this.board.turn_party] === 'external',
      botPending: !this.terminal && this.phase === 'moves' && this.movesLeft > 0 && this.controllers[this.board.turn_party] === 'bot',
      terminal: this.terminal, winner: this.winner, endedBy: this.endedBy };
  }

  legalMoves() {
    if (this.terminal || this.phase !== 'moves' || this.movesLeft <= 0) return [];
    const party = this.board.turn_party;
    const unique = new Map();
    for (const army of this.board.hw_parties_armies[party]) {
      if (army.moved || army.field.army !== army || army.party !== party) continue;
      const from = [army.field.fx, army.field.fy];
      for (const target of this.map.pathfinder.getPossibleMoves(army.field, { excludeSelf: true })) {
        const to = [target.fx, target.fy];
        const action = encodeAction(from, to);
        unique.set(action, { from, to, action });
      }
    }
    return [...unique.values()].sort((a,b) => a.action - b.action);
  }

  legalActions() {
    if (this.terminal || this.phase !== 'moves' || this.movesLeft <= 0) return [];
    return [...this.legalMoves().map(m => m.action), PASS];
  }

  applyAction(action) {
    if (!this.status().needsDecision) throw new Error('No external decision pending');
    if (!this.legalActions().includes(action)) throw new RangeError(`Illegal action ${action}`);
    this._decision('external', action);
    this._advance();
    return this.status();
  }

  applyBotMove() {
    if (!this.status().needsDecision) throw new Error('No external decision pending');
    this._decision('bot');
    this._advance();
    return this.status();
  }

  advance() {
    if (!this.status().botPending) throw new Error('No bot decision pending');
    this._decision('bot');
    this._advance();
    return this.status();
  }

  _decision(kind, action) {
    const party = this.board.turn_party;
    const recording = this.options.recordDecisions || this.onDecision;
    const before = recording ? {
      type: 'decision', i: this.decisions, round: this.board.turns, party,
      controller: this.controllers[party], moves_left: this.movesLeft,
      state_hash: this.hash(), n_legal: this.legalActions().length,
    } : null;
    this.map.lastMove = null;
    if (kind === 'bot') this.map.makeMove(party, this.board);
    else if (action !== PASS) {
      const { from, to } = decodeAction(action);
      this.map.moveArmy(this.map.getField(...from, this.board).army, this.map.getField(...to, this.board), this.board);
    }
    if (action !== PASS) this.map.updateArmies(this.board);
    if (recording) {
      const move = this.map.lastMove;
      const chosen = action === PASS ? PASS : move ? encodeAction(move.from, move.to) : null;
      const event = { ...before, action: chosen, from: move?.from ?? null, to: move?.to ?? null };
      if (chosen === null) event.noop = true;
      this.events.push(event);
      this.onDecision?.(event, this);
    }
    this.decisions++;
    this.movesLeft = action === PASS ? 0 : this.movesLeft - 1;
    this._checkElimination();
  }

  _checkElimination() {
    const { focusSeat, stopOnFocusElimination } = this.options;
    if (stopOnFocusElimination && focusSeat >= 0 && this.board.hw_parties_status[focusSeat] === 0) this._finish('eliminated');
  }

  _finish(reason) {
    this.terminal = true;
    this.endedBy = reason;
    this.winner = this.board.hw_parties_provinces_cp.findIndex(cp => cp?.length === 3);
    this.movesLeft = 0;
    this.events.push({ type: 'terminal', ...this.result() });
  }

  _advance() {
    while (!this.terminal) {
      if (this.phase === 'afterParty') {
        this._checkElimination();
        if (this.terminal) break;
        this.nextParty++;
        if (this.nextParty === 4) {
          this.nextParty = 0;
          this.completedRounds++;
          this.events.push({ type: 'round', round: this.completedRounds });
          if (this.map.isVictory(this.board)) this._finish('victory');
          else if (this.completedRounds >= this.options.maxRounds) this._finish('turn_limit');
        }
        this.phase = 'begin';
        continue;
      }
      if (this.phase === 'begin') {
        this.board.turns = this.completedRounds;
        this.board.turn_party = this.nextParty;
        this.board.duel = this.board.hw_parties_capitals.filter((f,p) => f.party === p).length < 3;
        this.movesLeft = this.map.getMovePoints(this.nextParty, this.board);
        this.map.cleanupTurn(this.board);
        this.map.updateBoard(this.board);
        this.phase = 'moves';
        this._checkElimination();
        if (this.terminal) break;
      }
      if (this.movesLeft > 0) {
        if (this.controllers[this.nextParty] === 'external' || !this.options.autoAdvanceBots) return;
        this._decision('bot');
        continue;
      }
      this.map.unitsSpawn(this.nextParty, this.board);
      this.phase = 'afterParty';
      this.onPartyTurn?.(this);
    }
  }

  snapshot() { return snapshot(this.board, this.movesLeft); }
  hash() { return stateHash(this.snapshot()); }
  drainEvents() { const events = [...this.events, ...this.map.events]; this.events.length = 0; this.map.events.length = 0; return events; }
  mapInfo() {
    const fields = cells.map(c => this.map.getField(c.x,c.y,this.board));
    return { terrain: fields.map(f => +(f.type === 'land')), estate: fields.map(f => f.estate === 'town' ? 1 : f.estate === 'port' ? 2 : 0),
      capital: fields.map(f => f.capital), town_name: fields.map(f => f.town_name ?? null),
      dist_to_capital: [0,1,2,3].map(p => fields.map(f => -f.profitability[p])) };
  }
  result() {
    const focus = this.options.focusSeat;
    return { rounds: this.completedRounds + (this.endedBy === 'eliminated' ? 1 : 0), winner: this.winner,
      ended_by: this.endedBy, external_outcome: focus < 0 ? null : this.winner === focus ? 'win' : this.endedBy === 'eliminated' ? 'loss' : 'limit',
      final_hash: this.hash() };
  }
}

export const createGame = options => new Game(options);
