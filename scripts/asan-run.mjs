// Runs a sanitizer build of a published game and writes every console line to a log (silent, headless).
// Usage: node scripts/asan-run.mjs <url> <log file> [seconds=600]
import {chromium} from '@playwright/test';
import {createWriteStream} from 'node:fs';
const [url,logFile,seconds='600']=process.argv.slice(2);
const log=createWriteStream(logFile);
const browser=await chromium.launch({channel:'msedge',args:['--mute-audio','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const page=await browser.newPage({viewport:{width:640,height:480}});
const started=Date.now();const at=()=>`${Math.round((Date.now()-started)/1000)}s`;
let done;const finished=new Promise(resolve=>done=resolve);
page.on('console',message=>{const text=message.text();log.write(`${at()} ${text}\n`);if(/AddressSanitizer|ABORTING/.test(text))setTimeout(done,5000);});
page.on('pageerror',error=>{log.write(`${at()} PAGEERROR ${error.message}\n${error.stack}\n`);setTimeout(done,5000);});
await page.goto(url,{waitUntil:'load',timeout:120000});
await page.waitForTimeout(3000);await page.mouse.click(320,240);
await Promise.race([finished,page.waitForTimeout(Number(seconds)*1000)]);
await page.screenshot({path:logFile.replace(/\.\w+$/,'.png')}).catch(()=>{});
log.end(`ended at ${at()}\n`);console.log(`ended at ${at()}`);
await browser.close();
