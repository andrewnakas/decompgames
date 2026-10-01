// Screenshots of games running through the site in a real (visible, muted) Chrome window, with the real GPU.
// Usage: node scripts/serve.mjs & node scripts/headed-shots.mjs <outDir> <id:seconds> [id:seconds ...]
// For each game: opens its page on the local preview, presses Play, waits, then saves the page and the frame.
import {chromium} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
const [out,...jobs]=process.argv.slice(2);await mkdir(out,{recursive:true});
const base=process.env.BASE||'http://127.0.0.1:4322';
const browser=await chromium.launch({channel:process.env.CHANNEL||'msedge',executablePath:process.env.CHROME||undefined,headless:false,args:['--mute-audio','--enable-unsafe-webgpu','--window-size=1300,950']});
const context=await browser.newContext({viewport:{width:1280,height:860}});
for(const job of jobs){
 const [id,seconds]=job.split(':');
 const page=await context.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message.slice(0,120)));
 try{
  await page.goto(`${base}/games/${id}/`,{waitUntil:'load'});
  await page.click('#play');
  const frame=page.locator('#stage iframe');
  await frame.waitFor({timeout:15000});
  // A click inside the frame gives the build its first gesture and dismisses any start screen.
  await page.waitForTimeout(8000);await frame.click({position:{x:320,y:240}}).catch(()=>{});
  await page.waitForTimeout(1000*Number(seconds||40));
  await page.locator('#stage').scrollIntoViewIfNeeded();
  await page.screenshot({path:`${out}/${id}-page.png`});
  await frame.screenshot({path:`${out}/${id}-frame.png`});
  const note=await page.locator('#stage-note').textContent().catch(()=>null);
  console.log(`${id}: ok${errors.length?' errors='+errors.join('|'):''}`);
 }catch(error){
  await page.screenshot({path:`${out}/${id}-page.png`}).catch(()=>{});
  console.log(`${id}: ${error.message.split('\n')[0]} note=${await page.locator('#stage-note').textContent().catch(()=>'')}`);
 }
 await page.close();
}
await browser.close();
