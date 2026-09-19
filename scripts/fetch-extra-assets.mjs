import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {dirname} from 'node:path';
import {unzipSync} from 'fflate';
import {createHash} from 'node:crypto';
const jobs=[['tyrian','https://www.camanis.net/tyrian/tyrian21.zip'],['openttd','https://cdn.openttd.org/opengfx-releases/8.0/opengfx-8.0-all.zip'],['openttd','https://cdn.openttd.org/opensfx-releases/1.0.3/opensfx-1.0.3-all.zip'],['openttd','https://cdn.openttd.org/openmsx-releases/0.4.2/openmsx-0.4.2-all.zip']];
const records=JSON.parse(await readFile('provenance/assets.json','utf8'));
for(const [game,url] of jobs){const r=await fetch(url);if(!r.ok)throw Error(`${r.status}: ${url}`);const archive=new Uint8Array(await r.arrayBuffer());for(const [name,bytes] of Object.entries(unzipSync(archive))){if(name.endsWith('/'))continue;const path=`public/data/${game}/${name.toLowerCase()}`;if(name.includes('..'))throw Error('Unexpected archive path');await mkdir(dirname(path),{recursive:true});await writeFile(path,bytes);records.push({path:path.slice(7),url,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});}console.log(`${game}: ${url.split('/').pop()}`);}
await writeFile('provenance/assets.json',JSON.stringify(records.filter((x,i,a)=>a.findIndex(y=>y.path===x.path)===i),null,2));
