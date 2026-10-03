import { writeFile } from 'node:fs/promises';
import { hexgrid } from '../engine/hexgrid.js';
await writeFile(new URL('../engine/hexgrid.json', import.meta.url), JSON.stringify(hexgrid) + '\n');
console.log('Exported 220 cells, 18 offsets and 3961 actions');
