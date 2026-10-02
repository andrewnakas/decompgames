// Prints the stack of the first page error a published build throws (silent, headless).
// Usage: node scripts/page-crash-stack.mjs <url> [seconds=240] [nokeys]
import {chromium} from '@playwright/test';
const [url,seconds='240',nokeys]=process.argv.slice(2);
const browser=await chromium.launch({channel:'msedge',args:['--mute-audio','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const page=await browser.newPage({viewport:{width:640,height:480}});
const started=Date.now();const at=()=>`${Math.round((Date.now()-started)/1000)}s`;
let done;const crashed=new Promise(resolve=>done=resolve);
page.on('pageerror',error=>{console.log(`pageerror at ${at()}: ${error.message}\n${(error.stack||'').split('\n').slice(0,25).join('\n')}`);done();});
page.on('console',message=>{if(message.type()==='error'&&!/404/.test(message.text()))console.log(`console at ${at()}: ${message.text().slice(0,300)}`);});
await page.goto(url,{waitUntil:'load',timeout:120000});
await page.waitForTimeout(3000);
await page.mouse.click(320,240);
const keys=nokeys?null:setInterval(()=>page.keyboard.press('Enter').catch(()=>{}),30000);
await Promise.race([crashed,page.waitForTimeout(Number(seconds)*1000)]);
clearInterval(keys);
await page.screenshot({path:'test-results/page-crash.png'}).catch(()=>{});
console.log(`ended at ${at()}`);
await browser.close();
