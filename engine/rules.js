import { MapGeneration } from './mapgen.js';
import { Bot } from './bot.js';
import { Pathfinder } from './pathfinder.js';
import { fieldKey, partyBoardKey, emptyPartyArrays, isCornerField, fieldPixelPosition, setIconLayout, compareArmiesByProfitability, MAX_ARMY_SIZE, PARTY_COUNT } from './board.js';
export class Rules extends MapGeneration {
  constructor(mapNumber) {
    super();
    if (!Number.isSafeInteger(mapNumber) || mapNumber < 0) throw new RangeError('mapNumber must be a nonnegative safe integer');
    this.towns = this.generateAllTowns();
    this.mapNumber = mapNumber;
    this.setSeed(mapNumber % 233280);
    this.pathfinder = new Pathfinder();
    this.bot = new Bot(this.pathfinder);
    this.captureEvents = false;
    this.events = [];
    this.lastMove = null;
  }

  unitsSpawn(party, board) {
    let ucount = board.hw_parties_lands[party].length + board.hw_parties_ports[party].length * 5;
    ucount = Math.floor(ucount / board.hw_parties_towns[party].length);
    for (let partyIndex = 0; partyIndex < board.hw_parties_count; partyIndex++) {
      if (board.hw_parties_capitals[partyIndex].party == party) {
        let morale = board.hw_parties_morale[party];
        if (board.hw_parties_capitals[partyIndex].army) {
          morale = board.hw_parties_capitals[partyIndex].army.morale;
        }
        this.joinUnits(5, morale, party, board, null, board.hw_parties_capitals[partyIndex]);
      }
    }
    for (let townIndex = 0; townIndex < board.hw_parties_towns[party].length; townIndex++) {
      let morale = board.hw_parties_morale[party];
      if (board.hw_parties_towns[party][townIndex].army) {
        morale = board.hw_parties_towns[party][townIndex].army.morale;
      }
      this.joinUnits(5 + ucount, morale, party, board, null, board.hw_parties_towns[party][townIndex]);
    }
  }

  joinUnits(count, morale, party, board, army, field) {
    if (!army) {
      army = field.army;
    }
    if (!field) {
      field = army.field;
    }
    if (!army) {
      this.updateArmy(count, morale, party, board, army, field);
    } else {
      this.updateArmy(army.count + count, Math.floor((army.count * army.morale + count * morale) / (army.count + count)), party, board, army, field);
    }
  }

  updateArmy(count, morale, party, board, army, field) {
    if (!army) {
      army = field.army;
    }
    if (!field) {
      field = army.field;
    }
    if (!board) {
      throw 'Board is undefined';
    }
    if (!army) {
      if (count <= 0) {
        return;
      }
      board.hw_lAID = board.hw_lAID + 1;
      const aname = `army${board.hw_lAID}`;
      board.armies[aname] = {};
      board.hw_aTL = -1; // TODO: find better value
      board.armies[aname]._x = field._x;
      board.armies[aname]._y = field._y;
      board.armies[aname].field = field;
      board.armies[aname].party = party;
      board.armies[aname].remove_time = -1;
      board.armies[aname].exploding = null;
      board.armies[aname].remove = false;
      board.armies[aname].waiting = null;
      board.armies[aname].is_waiting = false;
      field.army = board.armies[aname];
      army = field.army;
      // Need to add to avoid undefined
      army.moved = false;
    } else if (count <= 0) {
      this.deleteArmy(army);
      return;
    }
    army.count = count > MAX_ARMY_SIZE ? MAX_ARMY_SIZE : count;
    if (morale < 0) {
      morale = 0;
    }
    army.morale = morale >= army.count ? army.count : morale;
    army.party = party;
  }

  calcAIHelpers(board) {
    for (let partyIndex = 0; partyIndex < board.hw_parties_count; partyIndex++) {
      for (let x = 0; x < board.hw_xmax; x++) {
        for (let y = 0; y < board.hw_ymax; y++) {
          const field = this.getField(x, y, board);
          const path = this.pathfinder.findPath(field, board.hw_parties_capitals[partyIndex], [], true);
          if (!path) {
            console.warn(`Path is undefined for (${x},${y})`);
            continue;
          }
          field.profitability[partyIndex] = -path.length;
          const neighbours = this.pathfinder.getFurtherNeighbours(field);
          neighbours.push(field);
          for (let n = 0; n < neighbours.length; n++) {
            if (!neighbours[n]) {
              continue;
            }
            if (neighbours[n].capital == partyIndex) {
              field.n_capital[partyIndex] = true;
            }
            if (neighbours[n].estate == "town") {
              field.n_town = true;
            }
          }
        }
      }
    }
  }

  cleanupTurn(board) {
    const partyArmies = board.hw_parties_armies[board.turn_party];
    for (let armyIndex = 0; armyIndex < partyArmies.length; armyIndex++) {
      if (partyArmies[armyIndex].moved) {
        partyArmies[armyIndex].moved = false;
      } else {
        partyArmies[armyIndex].morale--;
      }
    }
  }

  updateBoard(board) {
    this.listArmies(board);
    for (let p = 0; p < board.hw_parties_count; p++) {
      this.checkPartyState(p, board);
    }
    board.hw_parties_towns = emptyPartyArrays();
    board.hw_parties_ports = emptyPartyArrays();
    board.hw_parties_lands = emptyPartyArrays();
    for (let x = 0; x < board.hw_xmax; x++) {
      for (let y = 0; y < board.hw_ymax; y++) {
        const field = this.getField(x, y, board);
        const party = field.party;
        this.updateField(field, board);

        const targetParty = this.getFieldParty(field);
        if (board.hw_parties_status[targetParty] == 0) {
          if (board.hw_parties_capitals[field.party]) {
            field.party = board.hw_parties_capitals[field.party].party;
            if (field.army) {
              this.setExplosion(field.army, field.army, null);
              this.updateGameLog(`Disbanded ${board.hw_parties_names[targetParty]} army at (${field.fx}, ${field.fy})`, 'disband', board);
            }
          }
        }
        if (party >= 0) {
          if (field.estate == "town") {
            board.hw_parties_towns[party].push(field);
          } else if (field.estate == "port") {
            board.hw_parties_ports[party].push(field);
          } else {
            board.hw_parties_lands[party].push(field);
          }
        }
      }
    }
    for (let partyIndex = 0; partyIndex < board.hw_parties_count; partyIndex++) {
      let morale = 0;
      if (board.hw_parties_armies[partyIndex].length > 0) {
        for (let armyIndex = 0; armyIndex < board.hw_parties_armies[partyIndex].length; armyIndex++) {
          if (board.hw_parties_armies[partyIndex][armyIndex].morale < Math.floor(board.hw_parties_total_count[partyIndex] / 50)) {
            board.hw_parties_armies[partyIndex][armyIndex].morale = Math.floor(board.hw_parties_total_count[partyIndex] / 50);
            // Morale can't be greater than the number of units
            if (board.hw_parties_armies[partyIndex][armyIndex].morale > board.hw_parties_armies[partyIndex][armyIndex].count) {
              board.hw_parties_armies[partyIndex][armyIndex].morale = board.hw_parties_armies[partyIndex][armyIndex].count;
            }
          }
          morale = morale + board.hw_parties_armies[partyIndex][armyIndex].morale;
        }
        morale = morale / board.hw_parties_armies[partyIndex].length;
      } else {
        morale = 10;
      }
      board.hw_parties_morale[partyIndex] = Math.floor(morale);
    }
    const humanTotalPower = board.hw_parties_morale[board.human] + board.hw_parties_total_count[board.human];
    let humanCondition = 1;
    for (let partyIndex = 0; partyIndex < board.hw_parties_count; partyIndex++) {
      if (partyIndex != board.human && board.hw_parties_status[partyIndex]) {
        if (humanTotalPower < 0.3 * (board.hw_parties_morale[partyIndex] + board.hw_parties_total_count[partyIndex])) {
          humanCondition = 3;
        } else if (humanCondition < 3
          && humanTotalPower < 0.6 * (board.hw_parties_morale[partyIndex] + board.hw_parties_total_count[partyIndex])) {
          humanCondition = 2;
        } else if (board.hw_parties_provinces_cp[board.human]
            && board.hw_parties_provinces_cp[board.human].length >= 2
            && humanTotalPower > 2 * (board.hw_parties_morale[partyIndex] + board.hw_parties_total_count[partyIndex])) {
          humanCondition = 0;
        }
      }
    }
    board.human_condition = humanCondition;
  }

  getFieldParty(field) {
    return field.army ? field.army.party : field.party;
  }

  listArmies(board) {
    for (let p = 0; p < board.hw_parties_count; p++) {
      board.hw_parties_armies[p] = [];
      board.hw_parties_total_count[p] = 0;
      board.hw_parties_total_power[p] = 0;
    }
    for (let x = 0; x < board.hw_xmax; x++) {
      for (let y = 0; y < board.hw_ymax; y++) {
        if (this.getField(x, y, board).army && this.getField(x, y, board).army.remove_time < 0) {
          const armyParty = this.getField(x, y, board).army.party;
          board.hw_parties_armies[armyParty].push(this.getField(x, y, board).army);
          board.hw_parties_total_count[armyParty] += this.getField(x, y, board).army.count;
          board.hw_parties_total_power[armyParty] += this.getField(x, y, board).army.count + this.getField(x, y, board).army.morale;
        }
      }
    }
  }

  checkPartyState(party, board) {
    if (board.hw_init) {
      board.hw_parties_status[party] = -1;
      return;
    }
    board.hw_parties_provinces_cp[party] = null;
    const otherCapitals = board.hw_parties_capitals.filter((capital, p) =>
      capital.party == party && p != party && !board.hw_parties_armies[p].length
    );
    if (board.hw_parties_capitals[party].party != party) {
      // Original party no longer controls capital
      board.hw_parties_status[party] = 0;
    } else if (otherCapitals.length > 0) {
      // Controls own capital and other capitals
      board.hw_parties_status[party] = 1 + otherCapitals.length;
      board.hw_parties_provinces_cp[party] = otherCapitals;
    } else {
      // Only controls own capital
      board.hw_parties_status[party] = 1;
    }
  }

  isVictory(board) {
    return board.hw_parties_provinces_cp.some((cp) => cp && cp.length == board.hw_parties_count - 1);
  }

  annexLand(party, field, board, startup) {
    const moraleEarned = (party, field) => {
      if (field.capital >= 0) {
        if (board.human == party
          && board.hw_parties_provinces_cp[party]
          && board.hw_parties_provinces_cp[party].length >= 2) {
          this.updateBoard(board);
          board.win = true;
        }
        if (field.capital == field.party) {
          if (board.human == party) {
            board.subject = field;
            board.news = "province_conquered";
          }
          this.updateGameLog(`${board.hw_parties_names[party]} conquered ${board.hw_parties_names[field.party]}`, 'conquest', board);
          return { allUnitsWithinParty: 50, capturingArmy: 30 };
        }
        if (board.human == party) {
          board.subject = field;
          board.news = "town_captured";
          this.updateGameLog(`${board.hw_parties_names[party]} captured former ${board.hw_parties_names[field.party]} capital city from ${board.hw_parties_names[field.party]}`, 'conquest', board);
        }
        return { allUnitsWithinParty: 30, capturingArmy: 20 };
      }
      if (field.estate == "town") {
        if (/*board.human == party && */ (!board.subject || board.subject.capital < 0)) {
          board.subject = field;
          if (field.party >= 0) {
            board.news = "town_captured";
            this.updateGameLog(`${board.hw_parties_names[party]} captured town ${field.town_name} from ${board.hw_parties_names[field.party]}`, 'capture', board);
          } else {
            board.news = "town_annexed";
            this.updateGameLog(`${board.hw_parties_names[party]} annexed town ${field.town_name}`, 'annex', board);
          }
        }
        return { allUnitsWithinParty: 10, capturingArmy: 10 };
      }
      if (field.estate == "port") {
        if (/*board.human == party &&*/ (!board.subject || board.subject.estate != "town")) {
          board.subject = field;
          if (field.party >= 0) {
            board.news = "town_captured";
            this.updateGameLog(`${board.hw_parties_names[party]} captured port ${field.town_name} from ${board.hw_parties_names[field.party]}`, 'capture', board);
          } else {
            board.news = "town_annexed";
            this.updateGameLog(`${board.hw_parties_names[party]} annexed port ${field.town_name}`, 'annex', board);
          }
        }
        return { allUnitsWithinParty: 5, capturingArmy: 5 };
      }
      if (field.type == "land") {
         return { allUnitsWithinParty: 1, capturingArmy: 0 };
      }
      return { allUnitsWithinParty: 0, capturingArmy: 0 };
    };
    const moraleLost = (party, field) => {
      if (field.capital == party) {
        if (board.human == party) {
          this.updateBoard(board);
          board.win = false;
        }
      } else {
        if (field.capital >= 0) {
          if (board.human == party) {
            board.subject = field;
            board.news = "town_lost";
          }
          return -30;
        }
        if (field.estate == "town") {
          if (board.human == party && (!board.subject || board.subject.capital < 0)) {
            board.subject = field;
            board.news = "town_lost";
          }
          return -10;
        }
        if (field.estate == "port") {
          if (board.human == party && (!board.subject || board.subject.estate != "town")) {
            board.subject = field;
            board.news = "town_lost";
          }
          return -5;
        }
      }
      return 0;
    };

    if (!field.army && !startup) {
      return;
    }
    if (field.type == "land") {
      if (field.party >= 0 && field.party != party) {
        this.addMoraleForAll(moraleLost(field.party, field), field.party, board);
        if (field.capital >= 0
          && field.capital == field.party
          && board.hw_parties_provinces_cp[field.party]
          && board.hw_parties_provinces_cp[field.party].length) {
          // If you conquer another party that has control of capitals other than their own, liberate those capitals
          for (let capitalIndex = 0; capitalIndex < board.hw_parties_provinces_cp[field.party].length; capitalIndex++) {
            if (board.hw_parties_provinces_cp[field.party][capitalIndex].army) {
              this.setExplosion(board.hw_parties_provinces_cp[field.party][capitalIndex].army, board.hw_parties_provinces_cp[field.party][capitalIndex].army, null);
              board.hw_parties_provinces_cp[field.party][capitalIndex].army = null;
            }
            // Liberate capitals and give original owner new army
            this.updateArmy(MAX_ARMY_SIZE, MAX_ARMY_SIZE, board.hw_parties_provinces_cp[field.party][capitalIndex].capital, board, null, board.hw_parties_provinces_cp[field.party][capitalIndex]);
            this.annexLand(board.hw_parties_provinces_cp[field.party][capitalIndex].capital, board.hw_parties_provinces_cp[field.party][capitalIndex], board, true);
          }
        }
      }
      if (!startup && field.party != party) {
        this.addMoraleForAA(moraleEarned(party,field), field.army, board);
      }
      field.party = party;
      for (let n = 0; n < 6; n++) {
        if (!field.neighbours[n]) {
          continue;
        }
        const isNeighbourShieldedByPact = board.hw_peace >= 0
          && ((field.neighbours[n].party == board.hw_peace && party == board.human)
          || (party == board.hw_peace && field.neighbours[n].party == board.human));
        if (field.neighbours[n].type == "land"
          && !field.neighbours[n].estate
          && !field.neighbours[n].army
          && !isNeighbourShieldedByPact
        ) {
            if (!startup && field.neighbours[n].party != party) {
               this.addMoraleForAA(moraleEarned(party,field.neighbours[n]), field.army, board);
            }
            field.neighbours[n].party = party;
        }
      }
    }
  }

  makeMove(party, board) {
    const rankedMoves = this.bot.calcArmiesProfitability(party, board);
    rankedMoves.sort(compareArmiesByProfitability);

    if (rankedMoves.length === 0 || !rankedMoves[0].move) {
      console.warn('No possible moves for party ', board.hw_parties_names[party]);
      return;
    }

    const bestMove = rankedMoves[0];
    if (!bestMove.move.wait_for_support) {
      board.hw_parties_wait_for_support_field[party] = null;
      board.hw_parties_wait_for_support_count[party] = 0;
      this.moveArmy(bestMove, bestMove.move, board);
      return;
    }

    if (bestMove.move === board.hw_parties_wait_for_support_field[party]) {
      board.hw_parties_wait_for_support_count[party]++;
    } else {
      board.hw_parties_wait_for_support_field[party] = bestMove.move;
      board.hw_parties_wait_for_support_count[party] = 0;
    }

    const supportArmies = this.bot.supportArmy(party, bestMove, bestMove.move, board);
    if (supportArmies.length > 0) {
      supportArmies.sort(compareArmiesByProfitability);
      this.moveArmy(supportArmies[0], supportArmies[0].move, board);
      return;
    }

    this.moveArmy(bestMove, bestMove.move, board);
  }

  moveArmy(army, field, board) {
    const originField = army.field;
    this.lastMove = { from: [originField.fx, originField.fy], to: [field.fx, field.fy] };
    this.updateGameLog(`${board.hw_parties_names[army.party]} moved unit from (${army.field.fx},${army.field.fy}) to (${field.fx},${field.fy})`, 'move', board);

    // Pact was just broken
    if (board.hw_peace >= 0
      && ((field.party == board.hw_peace && army.party == board.human)
      || (army.party == board.hw_peace && field.party == board.human))) {
        this.addMoraleForAll(30, field.party, board);
        board.hw_pact_just_broken = board.hw_peace;
        board.hw_peace = -1;
    }
    army.field.army = null;
    army.field = field;
    army.moved = true;
    if (field.army && field.party != army.party) {
      // Unit is in contact with enemy party
      if (!this.attack(army, field, board)) {
        this.updateBoard(board);
        return false;
      }
    } else if (field.army && field.party == army.party) {
      // Unit is joining with other friendly units
      if (field.army.count + army.count <= MAX_ARMY_SIZE) {
        this.joinUnits(army.count, army.morale, army.party, board, field.army);
      } else {
        // Only move enough units to fill other army up to the max
        const overflow = field.army.count + army.count - MAX_ARMY_SIZE;
        this.joinUnits(MAX_ARMY_SIZE - field.army.count, army.morale, army.party, board, field.army);
        this.joinUnits(overflow, army.morale, army.party, board, null, originField);
      }
      this.setArmyRemoval(army, field.army);
      field.army.moved = true;
      this.annexLand(army.party, field, board, false);
      this.updateBoard(board);
      return false;
    }
    field.army = army;
    this.annexLand(army.party, field, board, false);
    this.updateBoard(board);
    return true;
  }

  attack(attacker, field, board) {
    const defender = field.army;
    if (!defender) {
      return true;
    }
    const attackerPower = attacker.count + attacker.morale;
    const defenderPower = defender.count + defender.morale;
    if (attackerPower > defenderPower) {
      this.addMoraleForAll(-Math.floor(defender.count / 10), defender.party, board);
      attacker.count = attacker.count - Math.floor(defenderPower / attackerPower * attacker.count);
      attacker.count = attacker.count <= 0 ? 1 : attacker.count;
      attacker.morale = attacker.morale > attacker.count ? attacker.count : attacker.morale;
      this.setExplosion(attacker, defender, attacker);
      return true;
    }
    this.addMoraleForAll(-Math.floor(attacker.count / 10), attacker.party, board);
    defender.count = defender.count - Math.floor(attackerPower / defenderPower * attacker.count);
    defender.count = defender.count <= 0 ? 1 : defender.count;
    defender.morale = defender.morale > defender.count ? defender.count : defender.morale;
    this.setExplosion(attacker, attacker, defender);
    return false;
  }

  setArmyRemoval(army, waitingArmy) {
    army.remove = true;
    army.remove_time = 24;
    if (waitingArmy) {
      army.waiting = waitingArmy;
      waitingArmy.is_waiting = true;
    }
  }

  setExplosion(attacking, exploding, waitingArmy) {
    if (!exploding) {
      exploding = attacking;
    }
    attacking.exploding = exploding;
    exploding.remove_time = 36;
    if (waitingArmy) {
      attacking.waiting = waitingArmy;
      waitingArmy.is_waiting = true;
    }
  }

  deleteArmy(army) {
    if (army.field.army == army) {
      army.field.army = null;
    }
  }

  addMorale(morale, army) {
    morale = morale + army.morale;
    if (morale < 0) {
      morale = 0;
    }
    army.morale = morale >= army.count ? army.count : morale;
  }

  addMoraleForAll(morale, party, board) {
    if (morale == 0) {
      return;
    }
    for (let armyIndex = 0; armyIndex < board.hw_parties_armies[party].length; armyIndex++) {
      this.addMorale(morale, board.hw_parties_armies[party][armyIndex]);
    }
  }

  addMoraleForAA(morale, army, board) {
    this.addMorale(morale.capturingArmy, army);
    if (morale.allUnitsWithinParty != 0) {
      this.addMoraleForAll(morale.allUnitsWithinParty, army.party, board);
    }
  }

  updateArmies(board) {
    for (const [key, army] of Object.entries(board.armies)) {
      if (board.hw_parties_status[army.party] == 0) {
        this.deleteArmy(army);
        delete board.armies[key];
        continue;
      }

      if (army._x != army.field._x || army._y != army.field._y) {
        army._x = army._x - (army._x - army.field._x) / 2;
        army._y = army._y - (army._y - army.field._y) / 2;
        if (Math.abs(army._x - army.field._x) <= 1 && Math.abs(army._y - army.field._y) <= 1) {
          army._x = army.field._x;
          army._y = army.field._y;
        }
      } else {
         if (army.remove || army.remove_time > 0) {
           if (!army.waiting) {
             army.waiting = {};
           }
            army.waiting.is_waiting = false;
            this.deleteArmy(army);
            delete board.armies[key];
         }
      }
    }
  }

  getMovePoints(turnParty, board) {
    return Math.min(5, this.bot.getMovableArmies(turnParty, board).length);
  }

  updateGameLog(message, type = 'info', board = null) {
    if (this.captureEvents) this.events.push({ type, message, round: board?.turns ?? 0 });
  }
}
