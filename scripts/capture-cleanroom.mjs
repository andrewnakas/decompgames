// Silent headless captures of the published clean-room builds, for catalogue artwork.
// Usage: node scripts/capture-cleanroom.mjs [id ...]   (writes test-results/capture/<id>-<n>.png)
import {chromium} from '@playwright/test';
import {mkdir,readFile} from 'node:fs/promises';
const out='test-results/capture';await mkdir(out,{recursive:true});
const only=process.argv.slice(2);
const games=JSON.parse(await readFile('src/data/games.json','utf8')).filter(g=>g.mode==='embed'&&!g.requires&&(!only.length||only.includes(g.id)));
const browser=await chromium.launch({channel:'msedge',args:['--mute-audio','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
// Two at a time: each build is a full emulator or engine.
const queue=[...games];
async function worker(){
 for(let g;(g=queue.shift());){
  const context=await browser.newContext({viewport:{width:640,height:480}});
  const page=await context.newPage();
  try{
   await page.goto(g.embedUrl,{waitUntil:'load',timeout:120000});
   // Start prompts differ per runtime: try a click, then Enter, between waits.
   for(const [n,wait] of [[1,20000],[2,25000],[3,30000],[4,30000]]){
    await page.waitForTimeout(wait);
    // The game canvas only, without the page around it.
    const canvas=page.locator('canvas:visible').first();
    await (await canvas.count()?canvas:page).screenshot({path:`${out}/${g.id}-${n}.png`}).catch(()=>page.screenshot({path:`${out}/${g.id}-${n}.png`}));
    await page.mouse.click(320,240).catch(()=>{});
    await page.keyboard.press('Enter').catch(()=>{});
   }
   console.log(`${g.id}: captured`);
  }catch(error){console.log(`${g.id}: FAILED ${error.message.split('\n')[0]}`);}
  await context.close();
 }
}
await Promise.all([worker(),worker()]);
await browser.close();
