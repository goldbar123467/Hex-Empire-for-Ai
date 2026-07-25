
class Pathfinder {
  findPath(startf, endf, avoid_estate, avoid_water) {
    if (!startf || !endf) {
       return null;
    }
    if (avoid_water == undefined) {
       avoid_water = true;
    }
    if (startf.type == "water") {
      avoid_water = false;
    }
    const canWalk = (a, b) => this.canWalk(a, b, avoid_estate, avoid_water);
    const tiles = [];
    const path = [];
    const field1 = {};
    const field2 = {};
    tiles.push({ field:startf });
    tiles[tiles.length - 1].tc = 0;
    const move_cost = [5, 5, 5, 5, 5, 5];
    while ((path.length == 0 || (path.length > 0 && path[path.length - 1].field != endf)) && tiles.length > 0) {
      const currentTile = tiles.shift();
      for (let neighborNum = 0; neighborNum < 6; neighborNum++) {
        if(canWalk(currentTile.field, currentTile.field.neighbours[neighborNum])
          || currentTile.field.neighbours[neighborNum] == endf) {
          const newTile = {};
          newTile.field = currentTile.field.neighbours[neighborNum];
          const distance = this.getDistance(newTile.field, endf);
          newTile.parent = currentTile;
          newTile.dc = move_cost[neighborNum] + distance;
          newTile.tc = currentTile.tc + move_cost[neighborNum];
          if (field2[this.getFieldStrO(newTile.field)] == undefined) {
            if (field1[this.getFieldStrO(newTile.field)] == undefined) {
              field1[this.getFieldStrO(newTile.field)] = tiles.length;
              tiles.push(newTile);
            }
          } else if (path[field2[this.getFieldStrO(newTile.field)]].tc > newTile.tc) {
            path[field2[this.getFieldStrO(newTile.field)]] = newTile;
          }
        }
      }
      field2[this.getFieldStrO(currentTile.field)] = path.length;
      path.push(currentTile);
      if (tiles.length > 0) {
        let tileForSwap = 0;
        for (let tileNum = 1; tileNum < tiles.length; tileNum++) {
          if (tiles[tileNum].dc < tiles[tileForSwap].dc) {
            tileForSwap = tileNum;
          }
        }
        const temp = tiles[0];
        tiles[0] = tiles[tileForSwap];
        tiles[tileForSwap] = temp;
      }
    }
    if (tiles.length == 0) {
       return null;
    }
    const finalPath = [];
    let pathIndex = path.length - 1;
    while (finalPath[finalPath.length - 1] != startf)
    {
       finalPath.push(path[pathIndex].field);
       // Added to prevent undefined error
       if (!path[pathIndex].parent) {
         break;
       }
       pathIndex = field2[this.getFieldStrO(path[pathIndex].parent.field)];
    }
    finalPath.reverse();
    return finalPath;
  }

  canWalk(a, b, avoid_estate, avoid_water) {
    if (!a || !b) {
      return false;
    }
    for (let n = 0; n < avoid_estate.length; n++) {
      if (b.estate == avoid_estate[n]) {
        return false;
      }
    }
    if (!avoid_water) {
      return true;
    }
    if (a.type == "water" && b.type == "water") {
      return true;
    }
    if (a.type == "land" && b.type == "land") {
      return true;
    }
    if (a.type == "water" && b.type == "land") {
      return true;
    }
    if (b.type == "water" && a.estate == "port") {
      return true;
    }
    return false;
  }

  getFieldStrO(field) {
    return "f" + field.fx + "x" + field.fy;
  }

  getDistance(a, b) {
    const acx = a.fx * 5;
    const bcx = b.fx * 5;
    let acy, bcy;
    if (a.fx % 2 == 0) {
      acy = a.fy * 10;
    } else {
      acy = a.fy * 10 + 5;
    }
    if (b.fx % 2 == 0) {
      bcy = b.fy * 10;
    } else {
      bcy = b.fy * 10 + 5;
    }
    return Math.sqrt(Math.pow(acx - bcx, 2) + Math.pow(acy - bcy, 2));
  }

  getFurtherNeighbours(field) {
    const additionalNeighbours = [];
    if (field.neighbours[0]) {
      additionalNeighbours.push(field.neighbours[0].neighbours[0]);
      additionalNeighbours.push(field.neighbours[0].neighbours[1]);
    }
    if (field.neighbours[1]) {
      additionalNeighbours.push(field.neighbours[1].neighbours[1]);
      additionalNeighbours.push(field.neighbours[1].neighbours[2]);
    }
    if (field.neighbours[2]) {
      additionalNeighbours.push(field.neighbours[2].neighbours[2]);
    }
    if (field.neighbours[3]) {
      additionalNeighbours.push(field.neighbours[3].neighbours[3]);
      additionalNeighbours.push(field.neighbours[3].neighbours[4]);
    }
    if (field.neighbours[4]) {
      additionalNeighbours.push(field.neighbours[4].neighbours[4]);
      additionalNeighbours.push(field.neighbours[4].neighbours[5]);
    }
    if (field.neighbours[5]) {
      additionalNeighbours.push(field.neighbours[5].neighbours[5]);
    }

    additionalNeighbours.push(!field.neighbours[0] ? (field.neighbours[5] ? field.neighbours[5].neighbours[0] : undefined) : field.neighbours[0].neighbours[5]);
    additionalNeighbours.push(!field.neighbours[2] ? (field.neighbours[3] ? field.neighbours[3].neighbours[2] : undefined) : field.neighbours[2].neighbours[3]);
    return field.neighbours.concat(additionalNeighbours);
  }

  getPossibleMoves(field, no_self, check_power) {
    const joinCnd = (field1, field2) => {
      if (!field1) {
        return false;
      }
      if (field1 == field2) {
        return false;
      }
      if (!field1.army) {
        return true;
      }
      if (check_power && field1.army && field2.army && field1.army.party != field2.army.party) {
        const ap = field1.army.count + field1.army.morale;
        const bp = field2.army.count + field2.army.morale;
        if (bp < 0.75 * ap) {
          return false;
        }
      }
      return field1.army.party != field2.army.party || field1.type != "water" && field1.army.count < 99;
    };
    const reachableFields = no_self ? [] : [field];

    if (field.estate == "port") {
      for (let n = 0; n < 6; n++) {
        if (joinCnd(field.neighbours[n], field)) {
          reachableFields.push(field.neighbours[n]);
          if (field.neighbours[n].type == "water" && !field.neighbours[n].army) {
            for (let n2 = 0; n2 < 6; n2++) {
              if (!field.neighbours[n].neighbours[n2]) {
                continue;
              }
              if (field.neighbours[n].neighbours[n2].type == "water"
                && joinCnd(field.neighbours[n].neighbours[n2], field)) {
                  reachableFields.push(field.neighbours[n].neighbours[n2]);
              }
            }
          } else if (field.neighbours[n].type == "land"
            && !field.neighbours[n].estate
            && !field.neighbours[n].army) {
              for (let n2 = 0; n2 < 6; n2++) {
                if (!field.neighbours[n].neighbours[n2]) {
                  continue;
                }
                if (field.neighbours[n].neighbours[n2].type == "land"
                  && joinCnd(field.neighbours[n].neighbours[n2], field)) {
                    reachableFields.push(field.neighbours[n].neighbours[n2]);
                }
              }
          }
        }
      }
    } else if (field.type == "water") {
      for (let n = 0; n < 6; n++) {
        if (joinCnd(field.neighbours[n], field)) {
          reachableFields.push(field.neighbours[n]);
          if (field.neighbours[n].type == "water" && !field.neighbours[n].army) {
            for (let n2 = 0; n2 < 6; n2++) {
              if (joinCnd(field.neighbours[n].neighbours[n2], field)) {
                reachableFields.push(field.neighbours[n].neighbours[n2]);
              }
            }
          }
        }
      }
    } else if (field.type == "land") {
      for (let n = 0; n < 6; n++) {
        if (!field.neighbours[n]) {
          continue;
        }
        if (field.neighbours[n].type == "land" && joinCnd(field.neighbours[n], field)) {
          reachableFields.push(field.neighbours[n]);
          if (!field.neighbours[n].estate && !field.neighbours[n].army) {
            for (let n2 = 0; n2 < 6; n2++) {
              if (!field.neighbours[n].neighbours[n2]) {
                continue;
              }
              if (field.neighbours[n].neighbours[n2].type == "land" && joinCnd(field.neighbours[n].neighbours[n2],field)) {
                reachableFields.push(field.neighbours[n].neighbours[n2]);
              }
            }
          }
        }
      }
    }
    return reachableFields;
  }
}

export { Pathfinder }
