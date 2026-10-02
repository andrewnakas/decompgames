// Pilotwings 64 clean room: a first visit (no service worker yet) must end up cross-origin
// isolated and start. Fresh profile per run, because the fault is a race. Silent, headless.
// Usage: node scripts/test-pw64-firstvisit.mjs <url> [runs=5]
import {chromium} from '@playwright/test';
const [url='https://andrewnakas.github.io/pilotwings64-cleanroom/',runs='5']=process.argv.slice(2);
const browser=await chromium.launch({channel:'msedge',args:['--mute-audio','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
let good=0;
for(let run=1;run<=Number(runs);run++){
 const context=await browser.newContext({viewport:{width:640,height:480}});
 const page=await context.newPage();
 let errors=0;page.on('pageerror',()=>errors++);
 await page.goto(url,{waitUntil:'load',timeout:120000});
 await page.waitForTimeout(6000);
 await page.mouse.click(320,240).catch(()=>{});
 await page.waitForTimeout(40000);
 const isolated=await page.evaluate(()=>window.crossOriginIsolated).catch(()=>'?');
 const status=await page.evaluate(()=>{const o=document.getElementById('overlay');return o&&o.style.display!=='none'?document.getElementById('status').textContent:'running';}).catch(()=>'?');
 if(isolated===true&&!errors)good++;
 console.log(`run ${run}: isolated=${isolated} errors=${errors} status=${status}`);
 await context.close();
}
console.log(`${url}: ${good}/${runs} isolated without errors`);
await browser.close();
