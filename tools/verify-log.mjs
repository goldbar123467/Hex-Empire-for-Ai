import { parseArgs } from 'node:util';
import { readFile,readdir,stat,mkdir,rename } from 'node:fs/promises';
import { resolve,join,basename } from 'node:path';
import { randomUUID } from 'node:crypto';
import { verifyLog } from './lib/verify-log.mjs';
const {values,positionals}=parseArgs({allowPositionals:true,options:{quarantine:{type:'boolean'}}});
if(positionals.length!==1)throw new Error('Usage: node tools/verify-log.mjs <file|dir> [--quarantine]');
async function files(path){
 if((await stat(path)).isFile())return[path];
 const result=[];
 for(const entry of (await readdir(path,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){
  if(entry.isDirectory()&&entry.name!=='quarantine')result.push(...await files(join(path,entry.name)));
  else if(entry.isFile()&&entry.name.endsWith('.jsonl'))result.push(join(path,entry.name));
 }
 return result;
}
let failed=0,ok=0,abandoned=0;
for(const path of await files(resolve(positionals[0]))){
 try{
  const games=verifyLog(await readFile(path,'utf8'));
  for(const game of games){console.log(JSON.stringify({file:path,...game}));if(game.status==='ok')ok++;else abandoned++;}
 }catch(error){
  failed++;const report={file:path,status:'failed',reason:error.message};
  if(values.quarantine){const directory=resolve('data/raw/quarantine');await mkdir(directory,{recursive:true});report.quarantined_to=join(directory,`${randomUUID()}-${basename(path)}`);await rename(path,report.quarantined_to);}
  console.log(JSON.stringify(report));
 }
}
console.log(JSON.stringify({ok,abandoned,failed}));if(failed)process.exitCode=1;
