// Silent headless screenshots of one URL at the given seconds, with page errors reported.
// Usage: node scripts/shot-url.mjs <url> <outPrefix> <seconds> [seconds ...]   (MOBILE=1 for a phone in landscape)
import {chromium} from '@playwright/test';
const [url,out,...times]=process.argv.slice(2);
const browser=await chromium.launch({channel:'msedge',headless:!process.env.HEADED,args:process.env.HEADED?['--mute-audio']:['--mute-audio','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const context=await browser.newContext(process.env.MOBILE?{viewport:{width:844,height:390},hasTouch:true,isMobile:true}:{viewport:{width:900,height:600}});
const page=await context.newPage();
page.on('response',r=>{if(r.status()>=400)console.log('http',r.status(),r.url());});
page.on('pageerror',e=>console.log('pageerror:',e.message.slice(0,240)));
await page.goto(url,{waitUntil:'load'});
let at=0;
for(const t of times.map(Number)){await page.waitForTimeout(1000*(t-at));at=t;await page.screenshot({path:`${out}-${t}.png`});}
await browser.close();
