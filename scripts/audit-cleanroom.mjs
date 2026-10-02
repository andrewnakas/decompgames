// Silent headless quality audit of the published clean-room builds: later frames than
// capture-cleanroom.mjs plus the page errors each build throws.
// Usage: node scripts/audit-cleanroom.mjs [id ...]
//   writes test-results/capture/<id>-<n>.png and test-results/audit.json, prints one line per game.
import {chromium} from '@playwright/test';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
const out='test-results/capture';await mkdir(out,{recursive:true});
const only=process.argv.slice(2);
const games=JSON.parse(await readFile('src/data/games.json','utf8')).filter(g=>g.mode==='embed'&&!g.requires&&(!only.length||only.includes(g.id)));
const browser=await chromium.launch({channel:'msedge',args:['--mute-audio','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const report={};
const queue=[...games];
async function worker(){
 for(let g;(g=queue.shift());){
  const context=await browser.newContext({viewport:{width:640,height:480}});
  const page=await context.newPage();
  const errors=new Map();
  const note=text=>{const key=text.split('\n')[0].slice(0,160);errors.set(key,(errors.get(key)||0)+1);};
  page.on('pageerror',error=>note(`pageerror: ${error.message}`));
  page.on('crash',()=>note('page crashed'));
  page.on('console',message=>{if(message.type()==='error')note(`console: ${message.text()}`);});
  page.on('requestfailed',request=>note(`request failed: ${request.url().split('/').pop()}`));
  const started=Date.now();
  try{
   await page.goto(g.embedUrl,{waitUntil:'load',timeout:120000});
   // Start prompts differ per runtime: try a click, then Enter, between waits.
   for(const [n,wait] of [[1,20000],[2,30000],[3,40000],[4,60000]]){
    await page.waitForTimeout(wait);
    const canvas=page.locator('canvas:visible').first();
    await (await canvas.count()?canvas:page).screenshot({path:`${out}/${g.id}-${n}.png`}).catch(()=>page.screenshot({path:`${out}/${g.id}-${n}.png`}));
    await page.mouse.click(320,240).catch(()=>{});
    await page.keyboard.press('Enter').catch(()=>{});
   }
  }catch(error){note(`audit: ${error.message}`);}
  report[g.id]={url:g.embedUrl,seconds:Math.round((Date.now()-started)/1000),errors:[...errors].map(([text,count])=>({text,count}))};
  const worst=[...errors].filter(([text])=>!text.startsWith('request failed: favicon')).slice(0,2).map(([text,count])=>`${count}x ${text.slice(0,110)}`).join(' | ');
  console.log(`${g.id}: ${errors.size} error kinds${worst?`  ${worst}`:''}`);
  await context.close();
 }
}
await Promise.all([worker(),worker()]);
await browser.close();
await writeFile('test-results/audit.json',JSON.stringify(report,null,1));
