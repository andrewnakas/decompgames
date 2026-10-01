// Silent headless check of the shared pad's virtual-gamepad adapter (SDL and EmulatorJS builds).
// Usage: node scripts/test-vpad.mjs <url> <outDir> <firstShotSeconds> [key:holdSeconds:waitSeconds ...]
// Takes a screenshot, then for each step presses a pad button through the overlay state and takes another.
import {chromium} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
const [url,out,first,...steps]=process.argv.slice(2);await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:!process.env.HEADED,args:process.env.HEADED?['--mute-audio']:['--mute-audio','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const context=await browser.newContext(process.env.DESK?{viewport:{width:844,height:480}}:{viewport:{width:844,height:390},hasTouch:true,isMobile:true});
const page=await context.newPage();
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto(url+(url.includes('?')?'&':'?')+'touch=1',{waitUntil:'load'});
// Some runtimes wait for a first gesture: tap the game area part-way through the wait.
await page.waitForTimeout(500*Number(first));await (process.env.DESK?page.mouse.click(422,160):page.touchscreen.tap(422,160)).catch(()=>{});await page.waitForTimeout(500*Number(first));
const pads=await page.evaluate(()=>{const p=navigator.getGamepads()[0];return p?p.id:null;});
await page.screenshot({path:`${out}/0.png`});
let n=1;
for(const step of steps){
 const [key,hold,wait]=step.split(':');
 await page.evaluate(([key,hold])=>{const s=window.cleanroomPad.state,dir={up:[0,1],down:[0,-1],left:[-1,0],right:[1,0]}[key];if(dir){s.x=dir[0];s.y=dir[1];}else s[key]=1;setTimeout(()=>{if(dir){s.x=0;s.y=0;}else s[key]=0;},1000*Number(hold));},[key,hold]);
 await page.waitForTimeout(1000*Number(wait));
 await page.screenshot({path:`${out}/${n++}.png`});
}
console.log(JSON.stringify({pads,overlay:await page.evaluate(()=>!!document.querySelector('#cr-screen canvas')),errors}));
await browser.close();
