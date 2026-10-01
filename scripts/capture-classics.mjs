// Silent captures of the self-hosted games through the local preview's player, for catalogue artwork.
// Usage: node scripts/serve.mjs & node scripts/capture-classics.mjs <id> [id ...]   (writes test-results/classics/<id>-<n>.png)
import {chromium} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
const out='test-results/classics';await mkdir(out,{recursive:true});
const base=process.env.BASE||'http://127.0.0.1:4322';
const browser=await chromium.launch({channel:'msedge',headless:!process.env.HEADED,args:['--mute-audio']});
for(const id of process.argv.slice(2)){
 const page=await (await browser.newContext({viewport:{width:1000,height:800}})).newPage();
 try{
  await page.goto(`${base}/play/${id}/`,{waitUntil:'load'});
  await page.click('#start-game');
  const frame=page.locator('#game-frame');
  // Titles and menus differ per game: capture a few moments, nudging with a click and Enter in between.
  for(const [n,wait] of [[1,15000],[2,10000],[3,10000],[4,12000]]){
   await page.waitForTimeout(wait);
   await frame.screenshot({path:`${out}/${id}-${n}.png`});
   await frame.click({position:{x:300,y:200}}).catch(()=>{});
   await page.keyboard.press('Enter').catch(()=>{});
  }
  console.log(`${id}: ${await page.locator('#player-status').textContent()}`);
 }catch(error){console.log(`${id}: FAILED ${error.message.split('\n')[0]}`);}
 await page.close();
}
await browser.close();
