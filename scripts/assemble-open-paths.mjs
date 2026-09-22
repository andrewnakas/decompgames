// Experimental package only: explicit inputs prevent accidental upstream resource inclusion.
import {mkdir,readFile,writeFile,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
const output=resolve(process.argv[2]||'.cache/open-paths-package');
const resources=resolve(output,'resources');await mkdir(resources,{recursive:true});
if((await readdir(resources)).length)throw Error('Choose an empty output resources directory to avoid stale assets.');
const staged=[];
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
async function take(folder,record,name){
  if(!/^[A-Za-z0-9_.-]+$/.test(name))throw Error('Unexpected generated filename');
  const bytes=await readFile(resolve('.cache',folder,name));
  if(bytes.length!==record.bytes||hash(bytes)!==record.sha256)throw Error(`Generated file failed provenance check: ${name}`);
  return bytes;
}
for(const folder of ['open-font','open-tiles','open-moving','open-screens']) {
  const manifest=JSON.parse(await readFile(resolve('.cache',folder,'manifest.json'),'utf8'));
  if(manifest.originalAssetsUsed!==false||manifest.license!=='CC0-1.0')throw Error('Unapproved asset provenance');
  for(const record of manifest.files||[manifest.file]) {
    const name=record.filename||record.name;
    const bytes=await take(folder,record,name);staged.push({name,bytes,source:folder});
  }
}
const levels=JSON.parse(await readFile('.cache/open-puzzles/manifest.json','utf8'));
if(levels.levels.length!==6||levels.originalAssetsUsed!==false||levels.license!=='CC0-1.0')throw Error('Unexpected campaign');
const records=[];for(const level of levels.levels)records.push(await take('open-puzzles',level,level.file));
staged.push({name:'LEVELS.DAT',bytes:Buffer.concat(records),source:'open-puzzles'});
if(new Set(staged.map(f=>f.name)).size!==staged.length)throw Error('Duplicate asset');
for(const file of staged)await writeFile(resolve(resources,file.name),file.bytes);
await writeFile(resolve(output,'manifest.json'),JSON.stringify({id:'open-paths',license:'CC0-1.0',engineSourceRevision:'bad56a4e174e628643995284ea55d4c49af3137c',requiredEngineOption:'--replacement-pack',campaignLevels:6,campaignScope:'Navigation and exit puzzles; no collectibles, hazards or enemies.',releaseReady:false,blockers:['Package, deploy and repeat the verified muted gameplay/save flow on production'],files:staged.map(f=>({name:f.name,source:f.source,bytes:f.bytes.length,sha256:hash(f.bytes)}))},null,2)+'\n');
console.log(`Assembled ${staged.length} checked replacement files in ${resources}; release verification remains required.`);
