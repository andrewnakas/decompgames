import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {chromium} from '@playwright/test';
const results=[];
for(const id of ['tennis-sdl','craft']){
 const m=JSON.parse(await fs.readFile(`public/manifests/${id}.json`,'utf8'));
 const files=[];
 for(const f of m.files){
  const response=await fetch('https://decompgames.com'+m.base+f.path,{cache:'no-store'});
  const bytes=Buffer.from(await response.arrayBuffer());
  if(!response.ok||bytes.length!==f.bytes||createHash('sha256').update(bytes).digest('hex')!==f.sha256)throw Error(`${id}/${f.path}: production mismatch`);
  files.push(f.path);
 }
 const response=await fetch('https://decompgames.com'+m.sourceArchive,{cache:'no-store'});
 const source=Buffer.from(await response.arrayBuffer());
 if(!response.ok||createHash('sha256').update(source).digest('hex')!==m.sourceArchiveSha256)throw Error(`${id}: source mismatch`);
 results.push({id,files,sourceHash:true});
}
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--mute-audio']});
try{
 for(const result of results){
  const page=await browser.newPage();const errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  const response=await page.goto(`https://decompgames.com/games/${result.id}/player.html`);
  await page.waitForFunction(()=>document.getElementById('status').textContent.toLowerCase().includes('ready'),{},{timeout:60000});
  await page.waitForTimeout(result.id==='craft'?12000:1000);
  if(result.id==='craft'){
   if(!(await page.evaluate(()=>crossOriginIsolated)))throw Error('Craft production is not isolated');
   await page.locator('#canvas').click();await page.keyboard.down('s');await page.waitForTimeout(800);await page.keyboard.up('s');
   result.scope='Production release startup/rendering/input dispatch; exact state/save proof remains local diagnostic';
   result.isolated=true;result.coop=response.headers()['cross-origin-opener-policy'];result.coep=response.headers()['cross-origin-embedder-policy'];
  }else{
   const before=await page.evaluate(()=>Module._browser_value(0));
   await page.keyboard.down('w');await page.waitForTimeout(300);await page.keyboard.up('w');
   const after=await page.evaluate(()=>Module._browser_value(0));
   if(before===after)throw Error('Tennis production paddle did not move');
   result.scope='Production release startup and measured left-paddle keyboard movement';result.before=before;result.after=after;
  }
  result.errors=errors;if(errors.length)throw Error(`${result.id}: ${errors.join('; ')}`);
  await page.screenshot({path:`.cache/${result.id}-production.png`});await page.close();
 }
 await fs.writeFile('docs/github-intake-production.json',JSON.stringify({date:new Date().toISOString(),results},null,2)+'\n');
 console.log(JSON.stringify(results));
}finally{await browser.close();}
