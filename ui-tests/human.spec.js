const {test,expect}=require('@playwright/test');
const fs=require('node:fs/promises');
const path=require('node:path');
async function start(page,{seat=0,map=1234,watch=false}={}){
 await page.goto('/');await expect(page.locator('#startBattleButton')).toBeEnabled();
 await page.locator('#mapNumberInput').fill(String(map));
 await page.locator('#playerId').fill('automated_ui_test');
 await page.locator(`input[name=seat][value="${seat}"]`).check();
 await page.locator('#botSpeed').fill('0');
 await page.locator(watch?'#watchButton':'#startBattleButton').click();
 await expect(page.locator('#activePanel')).toBeVisible();
}
async function clickCell(page,cell){
 const rect=await page.locator('#map').boundingBox();
 const [x,y]=cell;
 await page.mouse.click(rect.x+(x*37.5+35)*rect.width/800,rect.y+(y*40+(x%2?40:20)+10)*rect.height/500);
}

test('complete human game uses canvas clicks and produces a verified disk log',async({page},testInfo)=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));await start(page);
 await page.waitForFunction(()=>game.engine.status().needsDecision);
 const initial=await page.evaluate(()=>game.engine.hash());
 const rect=await page.locator('#map').boundingBox();await page.mouse.click(rect.x+2,rect.y+2);
 expect(await page.evaluate(()=>game.engine.hash())).toBe(initial);
 let decisions=0;
 while(true){
  await page.waitForFunction(()=>game.engine.terminal||game.engine.status().needsDecision);
  const data=await page.evaluate(()=>({terminal:game.engine.terminal,move:game.engine.legalMoves()[0]}));if(data.terminal)break;
  if(data.move){
   await clickCell(page,data.move.from);
   if(decisions===0){await expect(page.locator('#selectionDetail')).toContainText('troops');await page.screenshot({path:testInfo.outputPath('selected-army.png'),fullPage:true});}
   await clickCell(page,data.move.to);
  }else await page.locator('#endTurnButton').click();
  expect(++decisions).toBeLessThan(3001);
 }
 await expect(page.locator('#saveStatus')).toHaveText('Saved & replay verified',{timeout:30000});
 await expect(page.locator('#resultPanel')).toBeVisible();
 const header=await page.evaluate(()=>game.logger.rows[0]);
 const saved=await fs.readFile(path.join('test-results/browser-logs',header.date,`${header.game_id}.jsonl`),'utf8');
 const {verifyLog}=await import('../tools/lib/verify-log.mjs');const reports=verifyLog(saved);
 expect(reports[0]).toMatchObject({status:'ok',decisions:81,rounds:9,final_hash:'bbb7b81d5abaf5a3'});
 expect(await page.evaluate(()=>game.engine.hash())).toBe(reports[0].final_hash);
 const before=await page.evaluate(()=>game.engine.hash());await page.locator('#replaySlider').fill('0');expect(await page.evaluate(()=>game.engine.hash())).toBe(before);
 await page.locator('#replayExit').click();await page.screenshot({path:testInfo.outputPath('finished.png'),fullPage:true});expect(errors).toEqual([]);
});

test('mobile seat selection and keyboard PASS preserve a replayable prefix',async({page},testInfo)=>{
 await page.setViewportSize({width:390,height:844});await start(page,{seat:2});
 await page.waitForFunction(()=>game.engine.status().needsDecision);
 expect(await page.evaluate(()=>game.board.human)).toBe(2);
 expect(await page.evaluate(()=>document.querySelector('.map-scroll').scrollLeft)).toBeGreaterThan(0);
 await page.keyboard.press('e');
 await page.waitForFunction(()=>game.logger.rows.some(row=>row.controller==='human'&&row.action===3960));
 await page.waitForFunction(()=>game.engine.terminal||game.engine.status().needsDecision);
 const log=await page.evaluate(()=>game.logger.text());const {verifyLog}=await import('../tools/lib/verify-log.mjs');
 expect(verifyLog(log)[0].status).toBe('abandoned');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:testInfo.outputPath('mobile-turn.png'),fullPage:true});
});

test('failed disk saves expose a valid download fallback',async({page},testInfo)=>{
 await page.route('**/api/log',route=>route.fulfill({status:507,contentType:'application/json',body:JSON.stringify({error:'Simulated disk failure'})}));
 await start(page);await expect(page.locator('#saveStatus')).toContainText('Save failed');
 const move=await page.evaluate(()=>game.engine.legalMoves()[0]);await clickCell(page,move.from);await clickCell(page,move.to);
 await page.waitForFunction(()=>game.engine.terminal||game.engine.status().needsDecision);
 const pending=page.waitForEvent('download');await page.locator('#downloadButton').click();const download=await pending;
 const saved=testInfo.outputPath('fallback.jsonl');await download.saveAs(saved);
 const {verifyLog}=await import('../tools/lib/verify-log.mjs');expect(verifyLog(await fs.readFile(saved,'utf8'))[0].status).toBe('abandoned');
 expect(download.suggestedFilename()).toMatch(/\.jsonl$/);
});

test('spectator mode completes the golden game without recording human data',async({page})=>{
 await start(page,{map:0,watch:true});await page.waitForFunction(()=>game.engine.terminal);
 expect(await page.evaluate(()=>game.engine.hash())).toBe('143a6b2e4373953d');
 expect(await page.evaluate(()=>game.logger)).toBeNull();await expect(page.locator('#downloadButton')).toBeHidden();
});
