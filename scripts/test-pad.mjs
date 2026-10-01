// Silent headless check of the shared clean-room touch pad on an N64Wasm build.
// Usage: node scripts/test-pad.mjs http://127.0.0.1:8141/ [outDir]
import {chromium} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
const url=process.argv[2];const out=process.argv[3]||'test-results/pad';await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'msedge',args:['--mute-audio','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
// A controller the test can plug in and out.
await context.addInitScript(()=>{const pad={id:'Test pad',index:0,connected:true,mapping:'standard',axes:[0.8,0,0,0],buttons:Array.from({length:17},(_,i)=>({pressed:i===0,value:i===0?1:0}))};navigator.getGamepads=()=>window.__plug?[pad]:[];});
const page=await context.newPage();
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto(url+'?touch=1',{waitUntil:'load'});
await page.waitForFunction(()=>document.querySelector('#cr-screen canvas'),null,{timeout:120000});
// Record what reaches the emulator.
await page.evaluate(()=>{const app=window.myApp,send=app.sendMobileControls;window.__sent=[];app.sendMobileControls=(bits,x,y)=>{window.__sent.push([bits,x,y]);return send(bits,x,y);};});
const last=()=>page.evaluate(()=>window.__sent[window.__sent.length-1]);
await page.waitForTimeout(25000);
await page.screenshot({path:`${out}/portrait.png`});
const idle=await last();
// Real touch on the A button and a short tap on Start.
const box=async id=>{const b=await page.locator(id).boundingBox();return [b.x+b.width/2,b.y+b.height/2];};
const [ax,ay]=await box('#cr-A');
await page.touchscreen.tap(ax,ay);await page.waitForTimeout(40);const tapped=await last();
await page.waitForTimeout(200);const released=await last();
// D-pad mode: the left thumb drives the D-pad bits.
await page.locator('#cr-mode').tap();
await page.evaluate(()=>{const s=document.querySelector('#cr-stick'),r=s.getBoundingClientRect();const ev=(t,x,y)=>s.dispatchEvent(new PointerEvent(t,{pointerId:7,clientX:x,clientY:y,bubbles:true}));s.setPointerCapture=()=>{};ev('pointerdown',r.left+80,r.top+150);ev('pointermove',r.left+80,r.top+60);});
await page.waitForTimeout(100);const dpadUp=await last();
await page.evaluate(()=>{const s=document.querySelector('#cr-stick');s.dispatchEvent(new PointerEvent('pointerup',{pointerId:7,bubbles:true}));});
await page.locator('#cr-mode').tap();
// Landscape.
await page.setViewportSize({width:844,height:390});await page.waitForTimeout(500);
await page.screenshot({path:`${out}/landscape.png`});
// Plug in a controller: the overlay hides and the controller's state is sent instead.
await page.evaluate(()=>{window.__plug=true;});await page.waitForTimeout(1500);
const hidden=await page.evaluate(()=>getComputedStyle(document.querySelector('#cr-A')).display==='none');
const fromPad=await last();
await page.screenshot({path:`${out}/controller.png`});
await page.evaluate(()=>{window.__plug=false;});await page.waitForTimeout(1500);
const back=await page.evaluate(()=>getComputedStyle(document.querySelector('#cr-A')).display!=='none');
console.log(JSON.stringify({idle,tapped,released,dpadUp,hidden,fromPad,back,errors},null,1));
await browser.close();
