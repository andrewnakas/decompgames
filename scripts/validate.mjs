import {readFile,access} from 'node:fs/promises';
import assert from 'node:assert/strict';
const games=JSON.parse(await readFile('src/data/games.json','utf8'));const ids=new Set();
for(const g of games){
 assert.match(g.id,/^[a-z0-9]+(?:-[a-z0-9]+)*$/);assert(!ids.has(g.id),`Duplicate ${g.id}`);ids.add(g.id);
 for(const key of ['title','description','overview','source','engineLicense','assetLicense','assetRequirements','saveInstructions','platform'])assert(typeof g[key]==='string'&&g[key].length>0,`${g.id}: missing ${key}`);
 assert(new URL(g.source).protocol==='https:');
 assert(['instant','files','embed'].includes(g.mode),`${g.id}: bad mode`);
 assert(['cleanroom','classic'].includes(g.shelf),`${g.id}: bad shelf`);
 assert(Array.isArray(g.controls)&&Array.isArray(g.limitations));
 if(g.mode==='embed'){assert(new URL(g.embedUrl).protocol==='https:',`${g.id}: embedUrl`);assert(['embed','tab'].includes(g.launch),`${g.id}: launch`);}
 // Self-hosted builds carry a dated test record; clean-room builds keep theirs in their own repository.
 else if(g.verification.status!=='unverified'){assert(g.verification.date&&g.verification.browsers.length&&g.verification.scope);}
 if(g.image)await access(`public${g.image}`);
}
if(process.argv.includes('--release')){const hosted=games.filter(g=>g.mode!=='embed');assert(hosted.every(g=>g.verification.status==='gameplay-tested'),'Every promoted integration must pass gameplay checks');for(const g of hosted){const m=JSON.parse(await readFile(`public/manifests/${g.id}.json`,'utf8'));assert(m.sourceRevision&&m.files?.length);await access(`public${m.sourceArchive}`);}}
console.log(`Validated ${games.length} catalog entries${process.argv.includes('--release')?' and release gates':''}.`);
