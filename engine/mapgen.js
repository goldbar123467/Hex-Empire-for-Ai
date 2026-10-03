import { Rng } from './rng.js';
import { fieldKey, partyBoardKey, emptyPartyArrays, isCornerField, fieldPixelPosition, setIconLayout, compareArmiesByProfitability, MAX_ARMY_SIZE, PARTY_COUNT } from './board.js';
export class MapGeneration extends Rng {
  generateAllTowns() {
    return [
      "Abu Dhabi", "Abuja", "Accra", "Addis Ababa", "Algiers", "Amman", "Amsterdam", "Ankara", "Antananarivo", "Apia", "Ashgabat", "Asmara", "Astana", "Asunción", "Athens",
		  "Baghdad", "Baku", "Bamako", "Bangkok", "Bangui", "Banjul", "Basseterre", "Beijing", "Beirut", "Belgrade", "Belmopan", "Berlin", "Bern", "Bishkek", "Bissau", "Bogotá",
		  "Brasília", "Bratislava", "Brazzaville", "Bridgetown", "Brussels", "Bucharest", "Budapest", "Buenos Aires", "Bujumbura", "Cairo", "Canberra",
		  "Cape Town", "Caracas", "Castries", "Chisinau", "Conakry", "Copenhagen", "Cotonou",
		  "Dakar", "Damascus", "Dhaka", "Dili", "Djibouti", "Dodoma", "Doha", "Dublin", "Dushanbe", "Delhi",
		  "Freetown", "Funafuti", "Gabarone", "Georgetown", "Guatemala City", "Hague", "Hanoi", "Harare", "Havana", "Helsinki", "Honiara", "Hong Kong",
		  "Islamabad", "Jakarta", "Jerusalem", "Kabul", "Kampala", "Kathmandu", "Khartoum", "Kyiv", "Kigali", "Kingston", "Kingstown", "Kinshasa", "Kuala Lumpur", "Kuwait City",
		  "La Paz", "Liberville", "Lilongwe", "Lima", "Lisbon", "Ljubljana", "Lobamba", "Lomé", "London", "Luanda", "Lusaka", "Luxembourg",
		  "Madrid", "Majuro", "Malé", "Managua", "Manama", "Manila", "Maputo", "Maseru", "Mbabane", "Melekeok", "Mexico City", "Minsk", "Mogadishu", "Monaco", "Monrovia", "Montevideo", "Moroni", "Moscow", "Muscat",
		  "Nairobi", "Nassau", "Naypyidaw", "N'Djamena", "New Delhi", "Niamey", "Nicosia", "Nouakchott", "Nuku'alofa", "Nuuk",
		  "Oslo", "Ottawa", "Ouagadougou", "Palikir", "Panama City", "Paramaribo", "Paris", "Phnom Penh", "Podgorica", "Prague", "Praia", "Pretoria", "Pyongyang",
		  "Quito", "Rabat", "Ramallah", "Reykjavík", "Riga", "Riyadh", "Rome", "Roseau",
		  "San José", "San Marino", "San Salvador", "Sanaá", "Santiago", "Santo Domingo", "Sao Tomé", "Sarajevo", "Seoul", "Singapore", "Skopje", "Sofia", "South Tarawa", "St. George's", "St. John's", "Stockholm", "Sucre", "Suva",
		  "Taipei", "Tallinn", "Tashkent", "Tbilisi", "Tegucigalpa", "Teheran", "Thimphu", "Tirana", "Tokyo", "Tripoli", "Tunis", "Ulaanbaatar",
		  "Vaduz", "Valletta", "Victoria", "Vienna", "Vientiane", "Vilnius", "Warsaw", "Washington", "Wellington", "Windhoek", "Yamoussoukro", "Yaoundé", "Yerevan", "Zagreb", "Zielona Góra",
		  "Poznań", "Wrocław", "Gdańsk", "Szczecin", "Łódź", "Białystok", "Toruń", "St. Petersburg", "Turku", "Örebro", "Chengdu",
		  "Wuppertal", "Frankfurt", "Düsseldorf", "Essen", "Duisburg", "Magdeburg", "Bonn", "Brno", "Tours", "Bordeaux", "Nice", "Lyon", "Stara Zagora", "Milan", "Bologna", "Sydney", "Venice", "New York",
		  "Barcelona", "Zaragoza", "Valencia", "Seville", "Graz", "Munich", "Birmingham", "Naples", "Cologne", "Turin", "Marseille", "Leeds", "Kraków", "Palermo", "Genoa",
		  "Stuttgart", "Dortmund", "Rotterdam", "Glasgow", "Málaga", "Bremen", "Sheffield", "Antwerp", "Plovdiv", "Thessaloniki", "Kaunas", "Lublin", "Varna", "Ostrava", "Iaşi", "Katowice",
		  "Cluj-Napoca", "Timişoara", "Constanţa", "Pskov", "Vitebsk", "Arkhangelsk", "Novosibirsk", "Samara", "Omsk", "Chelyabinsk", "Ufa", "Volgograd", "Perm", "Kharkiv", "Odessa", "Donetsk", "Dnipropetrovsk",
		  "Los Angeles", "Chicago", "Houston", "Phoenix", "Philadelphia", "Dallas", "Detroit", "Indianapolis", "San Francisco", "Atlanta", "Austin", "Vermont", "Toronto", "Montreal", "Vancouver", "Gdynia", "Edmonton",
    ];
  }

  getField(x, y, board) {
    return board.field[fieldKey(x, y)];
  }

  updateField(field, board) {
    if (!field.port) field.port = {};
    if (!field.town) field.town = {};

    field.port._visible = field.estate === "port";
    field.town._visible = field.estate === "town";

    if (field.army) {
      setIconLayout(field.town, 20, 20, 18, -4);
      setIconLayout(field.port, 20, 20, 18, -4);
    } else if (field.capital < 0) {
      setIconLayout(field.town, 20, 20);
      setIconLayout(field.port, 35, 35);
    } else {
      setIconLayout(field.town, 35, 35);
      setIconLayout(field.port, 35, 35);
    }

    const { fx: x, fy: y } = field;
    const key = fieldKey(x, y);
    const partyBoard = board[partyBoardKey(field.party)];

    if (field.party >= 0 && !partyBoard[key]) {
      const { px, py } = fieldPixelPosition(x, y, board);
      partyBoard[key] = { _x: px, _y: py };
    }
  }

  addTown(x, y, board) {
    const field = this.getField(x, y, board);
    field.townVisual = [this.rand(6), this.rand(6) + 1, this.rand(2), this.rand(2), this.rand(360)];
  }

  findNeighbours(field, board) {
    // Neighbour offsets [dx, dy] by direction (0-5), for even vs odd columns.
    const offsetsEven = [[1, 0], [0, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
    const offsetsOdd = [[1, 1], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, 0]];
    const offsets = field.fx % 2 == 0 ? offsetsEven : offsetsOdd;
    field.neighbours = offsets.map(([dx, dy]) => this.getField(field.fx + dx, field.fy + dy, board));
  }

  createBackground(board) {
    board.backgroundTiles = [];
    for (let x = 0; x < 6; x++) {
      for (let y = 0; y < 4; y++) {
        board.backgroundTiles.push([x, y, this.rand(6) + 1, this.rand(6) + 1, this.rand(2), this.rand(2), this.rand(4) * 90]);
      }
    }
  }

  addField(x, y, board) {
    const key = fieldKey(x, y);
    board.field[key] = {};
    const nfield = board.field[key];
    nfield.fx = x;
    nfield.fy = y;
    if (x === board.hw_xmax - 1 && y === board.hw_ymax - 1) {
      board.hw_top_field_depth = -1; // TODO: find a better value
    }
    const { px, py } = fieldPixelPosition(x, y, board);
    nfield._x = px;
    nfield._y = py;
    nfield.land_id = -1;
    nfield.type = isCornerField(x, y, board) || this.rand(10) <= 1 ? "land" : "water";
    nfield.party = -1;
    nfield.capital = -1;
    nfield.n_town = false;
    nfield.army = null;

    nfield.profitability = [0,0,0,0];
    nfield.tmp_prof = [0,0,0,0];
    nfield.n_capital = [false,false,false,false];
    nfield.doom = 0;
    nfield.over = false;
  }

  generateMap(board) {
    this.createBackground(board);

    for (let p = 0; p < board.hw_parties_count; p++) {
      if (!board["pb" + p]) {
        // Used to color occupied tiles
        board["pb" + p] = {};
      }
    }

    for (let x = 0; x < board.hw_xmax; x++) {
      for (let y = 0; y < board.hw_ymax; y++) {
        this.addField(x, y, board);
      }
    }

    for (let x = 0; x < board.hw_xmax; x++) {
      for (let y = 0; y < board.hw_ymax; y++) {
        const field = this.getField(x, y, board);
        this.findNeighbours(field, board);
      }
    }

    this.setLandFields(board);
    this.generateHwLands(board);
    this.generatePartyCapitals(board);
    this.generateTowns(board);
    board.hw_towns = this.shuffle(board.hw_towns);
    this.generatePorts(board);

    this.drawWaterAndPorts(board);
    this.assignTownNames(board);
  }

  generatePartyCapitals(board) {
    let capitalIndex = 0;
    for (let x = 0; x < board.hw_xmax; x++) {
      for (let y = 0; y < board.hw_ymax; y++) {
        if (!isCornerField(x, y, board)) continue;

        const field = this.getField(x, y, board);
        field.estate = "town";
        field.capital = capitalIndex;
        board.hw_towns.push(field);
        board.hw_parties_capitals[capitalIndex] = field;
        this.annexLand(capitalIndex, field, board, true);
        capitalIndex++;
      }
    }
  }

  setLandFields(board) {
    for (let x = 0; x < board.hw_xmax; x++) {
      for (let y = 0; y < board.hw_ymax; y++) {
        const field = this.getField(x, y, board);
        if (field.type == "water") {
          let land = 0;
          for (let n = 0; n < 6; n++) {
            if (!field.neighbours[n]) {
              continue;
            }
            if (field.neighbours[n].type == "land") {
              land++;
            }
          }
          if (land >= 1) {
            this.getField(x, y, board).tl = true;
          }
        }
      }
    }

    for (let x = 0; x < board.hw_xmax; x++) {
      for (let y = 0; y < board.hw_ymax; y++) {
        if (this.getField(x, y, board).tl) {
          this.getField(x, y, board).type = "land";
        }
      }
    }

    for (let x = 0; x < board.hw_xmax; x++) {
      for (let y = 0; y < board.hw_ymax; y++) {
        const field = this.getField(x, y, board);
        if (field.type == "water") {
          let water = 0;
          for (let n = 0; n < 6; n++) {
            if (!field.neighbours[n]) {
              continue;
            }
            if (field.neighbours[n].type == "water") {
              water++;
            }
          }
          if (!water) {
            this.getField(x, y, board).type = "land";
          }
        }
      }
    }
  }

  generateHwLands(board) {
    for (let x = 0; x < board.hw_xmax; x++) {
      for (let y = 0; y < board.hw_ymax; y++) {
        if (this.getField(x, y, board).type == "land") {
          board.hw_land = board.hw_land + 1;
        }
      }
    }

    for (let x = 0; x < board.hw_xmax; x++) {
      for (let y = 0; y < board.hw_ymax; y++) {
        if (this.getField(x, y, board).type == "land" && this.getField(x, y, board).land_id < 0) {
          const landId = board.hw_lands.length;
          board.hw_lands.push([]);
          board.hw_lands[landId].push(this.getField(x, y, board));
          this.getField(x, y, board).land_id = landId;
          // Adds field's unclaimed land neighbours to this region (closes over landId above).
          const addNeighboursToLand = (field) => {
            let queuedCount = 0;
            for (let n = 0; n < 6; n++) {
              if (field.neighbours[n] && field.neighbours[n].type == "land" && field.neighbours[n].land_id < 0) {
                board.hw_lands[landId].push(field.neighbours[n]);
                field.neighbours[n].land_id = landId;
                queuedCount++;
              }
            }
            return queuedCount;
          };
          // Breadth-first flood fill: board.hw_lands[landId] is itself the growing BFS queue -
          // expandIndex walks forward through it while lastQueuedIndex tracks how far it's grown.
          let lastQueuedIndex = 0;
          let expandIndex = lastQueuedIndex;
          while (lastQueuedIndex >= expandIndex) {
            lastQueuedIndex = lastQueuedIndex + addNeighboursToLand(board.hw_lands[landId][expandIndex]);
            expandIndex++;
          }
        }
      }
    }
  }

  generateTowns(board) {
    for (let landNum = 0; landNum < board.hw_lands.length; landNum++) {
      const townCount = Math.floor(board.hw_lands[landNum].length / 10) + 1;
      for (let townNum = 0; townNum < townCount; townNum++) {
        let created = false;
        let attempts = 0;
        while (!created) {
          attempts++;
          if (attempts > 10) {
            created = true;
          }
          const nt = this.rand(board.hw_lands[landNum].length);
          if (!board.hw_lands[landNum][nt].estate) {
            let ok = true;
            for (let n = 0; n < 6; n++) {
              const field = board.hw_lands[landNum][nt];
              if (!field.neighbours[n]) {
                continue;
              }
              if (field.neighbours[n].type == "water" || field.neighbours[n].estate) {
                ok = false;
              }
            }
            if (ok) {
              board.hw_lands[landNum][nt].estate = "town";
              board.hw_towns.push(board.hw_lands[landNum][nt]);
              created = true;
            }
          }
        }
      }
    }
  }

  generatePorts(board) {
    let portNum = 0;
    for (let town = 0; town < board.hw_towns.length - 1; town++) {
      let path = this.pathfinder.findPath(board.hw_towns[town], board.hw_towns[town + 1], ["town"], true);
      if (path == null || path.length > portNum) {
        path = this.pathfinder.findPath(board.hw_towns[town], board.hw_towns[town + 1], ["town"], false);
      }
      for (let pathIndex = 1; pathIndex < path.length - 1; pathIndex++) {
        if (path[pathIndex].type == "land" && path[pathIndex + 1].type == "water") {
          path[pathIndex].estate = "port";
          portNum++;
        }
        if (path[pathIndex].type == "land" && path[pathIndex - 1].type == "water") {
          path[pathIndex].estate = "port";
          portNum++;
        }
      }
    }
  }

  drawWaterAndPorts(board) {
    for (let x = 0; x < board.hw_xmax; x++) {
      for (let y = 0; y < board.hw_ymax; y++) {
        const field = this.getField(x, y, board);
        if (field.type !== 'water') continue;
        field.seaVisual = [this.rand(6) + 1, this.rand(2) * 180, this.rand(2), this.rand(2)];
      }
    }
  }

  assignTownNames(board) {
    for (let x = 0; x < board.hw_xmax; x++) {
      for (let y = 0; y < board.hw_ymax; y++) {
        const field = this.getField(x, y, board);
        this.updateField(field, board);

        if (field.estate === "town" || field.estate === "port") {
          this.addTown(x, y, board);
          field.town_name = this.randTown();
          continue;
        }

        if (!field.town_sign) field.town_sign = {};
        field.town_sign._visible = false;
      }
    }
  }
}
