export class Rng {
  setSeed(seed) {
    this.rnd_seed = seed;
  }

  rand(n) {
    this.rnd_seed = (this.rnd_seed * 9301 + 49297) % 233280;
    return Math.floor(this.rnd_seed / 233280 * n);
  }

  shuffle(arr) {
    const arrayCopy = [...arr];
    for (let index = 0; index < arrayCopy.length; index++) {
      const tmp = arrayCopy[index];
      const rn = this.rand(arrayCopy.length);

      // Swap with random index
      arrayCopy[index] = arrayCopy[rn];
      arrayCopy[rn] = tmp;
    }
    return arrayCopy;
  }

  randTown() {
    const cnr = this.rand(this.towns.length);
    const cname = this.towns[cnr];
    this.towns[cnr] = this.towns[0];
    this.towns[0] = cname;
    return this.towns.shift();
  }
}
