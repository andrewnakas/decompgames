// Like capture-cleanroom.mjs for builds that download slowly: frames at 3, 4, 5 and 6 minutes.
// Usage: node scripts/capture-slow.mjs <id> [id ...]   (writes test-results/capture/<id>-<n>.png)
import {chromium} from '@playwright/test';
import {mkdir,readFile} from 'node:fs/promises';
const out='test-results/capture';await mkdir(out,{recursive:true});
const only=process.argv.slice(2);
const games=JSON.parse(await readFile('src/data/games.json','utf8')).filter(g=>only.includes(g.id));
const browser=await chromium.launch({channel:'msedge',args:['--mute-audio','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
await Promise.all(games.map(async g=>{
 const context=await browser.newContext({viewport:{width:640,height:480}});
 const page=await context.newPage();
 try{
  await page.goto(g.embedUrl,{waitUntil:'load',timeout:120000});
  for(const [n,wait] of [[1,180000],[2,60000],[3,60000],[4,60000]]){
   // Start prompts differ per runtime: a click and Enter every 20 seconds.
   for(let t=0;t<wait;t+=20000){await page.waitForTimeout(20000);await page.mouse.click(320,240).catch(()=>{});await page.keyboard.press('Enter').catch(()=>{});}
   const canvas=page.locator('canvas:visible').first();
   await (await canvas.count()?canvas:page).screenshot({path:`${out}/${g.id}-${n}.png`}).catch(()=>page.screenshot({path:`${out}/${g.id}-${n}.png`}));
  }
  console.log(`${g.id}: captured`);
 }catch(error){console.log(`${g.id}: FAILED ${error.message.split('\n')[0]}`);}
 await context.close();
}));
await browser.close();
