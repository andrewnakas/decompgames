// Silent headless screenshots of the local preview, for design review.
// Usage: node scripts/serve.mjs & node scripts/shots.mjs [outDir]
import {chromium} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
const out=process.argv[2]||'test-results/shots';await mkdir(out,{recursive:true});
const base=process.env.BASE||'http://127.0.0.1:4322';
const pages=[['home','/'],['game-embed','/games/star-fox-64/'],['game-classic','/games/digger/'],['play-classic','/play/digger/'],['clean-room','/clean-room/'],['platform','/platform/n64/']];
const browser=await chromium.launch({channel:'msedge',args:['--mute-audio']});
for(const [label,width,height] of [['desktop',1280,900],['phone',390,844]]){
 const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1});
 const page=await context.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const [name,path] of pages){await page.goto(base+path,{waitUntil:'load'});await page.screenshot({path:`${out}/${name}-${label}.png`,fullPage:name!=='home'||label==='phone'?false:false});}
 // Catalogue behaviour: chip filter and search.
 await page.goto(base+'/');await page.click('.gf-chip[data-cat="racing"]');const racing=await page.locator('.pc-item:not([hidden])').count();
 await page.click('.gf-chip[data-cat=""]');await page.fill('#gf-search','zelda');await page.waitForTimeout(250);const zelda=await page.locator('.pc-item:not([hidden])').count();
 console.log(`${label}: racing=${racing} zelda=${zelda} errors=${errors.length?errors.join(' | '):'none'}`);
 await context.close();
}
await browser.close();
