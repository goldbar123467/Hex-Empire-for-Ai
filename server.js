const express=require('express');
const http=require('node:http');
const path=require('node:path');
const fs=require('node:fs/promises');
const {execFileSync}=require('node:child_process');
const {randomUUID}=require('node:crypto');

async function createApp({logDir=path.resolve(process.env.HEX_LOG_DIR||path.join(__dirname,'data/raw/human')),version}={}){
 const {RULES_VERSION}=await import('./engine/index.js');
 const {parseLog,validateHeader,verifyLog}=await import('./tools/lib/verify-log.mjs');
 const app=express(),writes=new Map();
 const getVersion=()=>{
  if(version)return version;
  const commit=execFileSync('git',['rev-parse','HEAD'],{cwd:__dirname,encoding:'utf8',windowsHide:true}).trim();
  const dirty=execFileSync('git',['status','--porcelain','--untracked-files=normal'],{cwd:__dirname,encoding:'utf8',windowsHide:true}).trim().length>0;
  return {engine_commit:commit+(dirty?'-dirty':''),rules_version:RULES_VERSION};
 };
 app.disable('x-powered-by');
 app.use((req,res,next)=>{
  if(!['127.0.0.1','localhost','[::1]','::1'].includes(req.hostname))return res.status(403).json({error:'Localhost only'});
  res.set('X-Content-Type-Options','nosniff');
  res.set('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
  next();
 });
 app.get('/api/version',(req,res)=>{res.set('Cache-Control','no-store');res.json(getVersion());});
 app.post('/api/log',express.json({limit:'4mb'}),async(req,res)=>{
  if(req.get('origin') && req.get('origin')!==`http://${req.get('host')}`)return res.status(403).json({error:'Cross-origin writes are disabled'});
  try{
   const text=req.body?.log;
   if(typeof text!=='string'||!text.endsWith('\n'))throw new Error('A complete JSONL prefix ending in newline is required');
   const rows=parseLog(text),header=validateHeader(rows[0]);
   if(header.source!=='human'||! /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(header.game_id))throw new Error('Expected one human game with a UUID');
   if(rows.slice(1).some((row,i)=>row.type==='header'||(row.type==='result'&&i!==rows.length-2)))throw new Error('Expected one game and an optional final result');
   const complete=rows.at(-1).type==='result';
   const decisions=rows.filter(row=>row.type==='decision');
   if(decisions.some((row,i)=>row.i!==i))throw new Error('Decision indices must be contiguous');
   const directory=path.join(logDir,header.date),file=path.join(directory,`${header.game_id}.jsonl`);
   const save=async()=>{
    let previous='';try{previous=await fs.readFile(file,'utf8');}catch(error){if(error.code!=='ENOENT')throw error;}
    if(previous && previous.startsWith(text)){
     const stored=verifyLog(previous)[0];
     return {saved:true,stale:previous.length>text.length,complete:stored.status==='ok',verified:stored.status==='ok',bytes:Buffer.byteLength(previous)};
    }
    if(previous && !text.startsWith(previous)){const error=new Error('Saved game is not a prefix of this request');error.status=409;throw error;}
    verifyLog(text);
    await fs.mkdir(directory,{recursive:true});
    const temporary=path.join(directory,`.${header.game_id}.${randomUUID()}.tmp`);
    let handle;
    try{handle=await fs.open(temporary,'wx',0o600);await handle.writeFile(text,'utf8');await handle.sync();await handle.close();handle=null;await fs.rename(temporary,file);}
    catch(error){if(handle)await handle.close();await fs.unlink(temporary).catch(()=>{});throw error;}
    return {saved:true,complete,verified:complete,bytes:Buffer.byteLength(text),decisions:decisions.length};
   };
   const pending=(writes.get(file)||Promise.resolve()).catch(()=>{}).then(save);writes.set(file,pending);
   try{res.json(await pending);}finally{if(writes.get(file)===pending)writes.delete(file);}
  }catch(error){res.status(error.status||400).json({error:error.message});}
 });
 app.use('/engine',express.static(path.join(__dirname,'engine')));
 app.use(express.static(path.join(__dirname,'public')));
 app.use((error,req,res,next)=>res.status(error.status||500).json({error:error.type==='entity.too.large'?'Game log exceeds 4 MB':error.message}));
 return app;
}
if(require.main===module)createApp().then(app=>{
 const port=Number(process.env.PORT||3000);
 http.createServer(app).listen(port,'127.0.0.1',()=>console.log(`Hex Empire is ready at http://127.0.0.1:${port}`));
}).catch(error=>{console.error(error);process.exitCode=1;});
module.exports={createApp};
