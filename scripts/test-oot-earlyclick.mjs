// Ocarina of Time clean room: a click while the game is still loading must not abort it.
// Runs the live page as published, then with the guarded page substituted. Silent, headless.
// Usage: node scripts/test-oot-earlyclick.mjs
import {chromium} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
const url='https://andrewnakas.github.io/oot-cleanroom/';
await mkdir('test-results',{recursive:true});
const live=await (await fetch(url)).text();
export const patch=html=>html
 .replace('onRuntimeInitialized:function(){','onRuntimeInitialized:function(){window._rtReady=!0;')
 .replace('if(Module&&Module._web_wants_text_input)','if(Module&&window._rtReady&&Module._web_wants_text_input)');
const fixed=patch(live);
console.log(`patch applied: ${fixed.length-live.length} bytes added`);
const browser=await chromium.launch({channel:'msedge',args:['--mute-audio','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const only=process.argv[2];
for(const [name,body] of [['live',null],['fixed',fixed]].filter(([name])=>!only||only===name)){
 const context=await browser.newContext({viewport:{width:640,height:480}});
 const page=await context.newPage();
 let aborts=0;
 page.on('console',message=>{if(/Aborted\(/.test(message.text()))aborts++;});
 page.on('pageerror',()=>aborts++);
 if(body)await page.route(url,route=>route.fulfill({contentType:'text/html',body}));
 await page.goto(url,{waitUntil:'load',timeout:120000});
 // Clicks while it downloads and starts, as an impatient player would.
 for(let i=0;i<6;i++){await page.waitForTimeout(4000);await page.mouse.click(320,240);}
 await page.waitForTimeout(150000);
 const canvas=page.locator('canvas:visible').first();
 const shown=await canvas.count();
 await (shown?canvas:page).screenshot({path:`test-results/oot-earlyclick-${name}.png`});
 console.log(`${name}: aborts=${aborts} canvas=${shown?'visible':'hidden'}`);
 await context.close();
}
await browser.close();
