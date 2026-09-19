import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const manifest=JSON.parse(await readFile('public/manifests/scummvm.json','utf8'));
const root=process.platform==='win32'?'\\\\wsl.localhost\\Ubuntu\\home\\nakas\\decompgames-build':'/home/nakas/decompgames-build';
const records=JSON.parse(await readFile('provenance/assets.json','utf8'));
for(const file of ['sky.cpt','lure.dat']){
 const path=`data/scummvm/${manifest.sourceRevision.slice(0,12)}/${file}`;
 await mkdir(`public/data/scummvm/${manifest.sourceRevision.slice(0,12)}`,{recursive:true});
 await copyFile(`${root}/scummvm/dists/engine-data/${file}`,`public/${path}`);
 const bytes=await readFile(`public/${path}`);
 records.push({path,url:`https://github.com/scummvm/scummvm/blob/${manifest.sourceRevision}/dists/engine-data/${file}`,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
}
await writeFile('provenance/assets.json',JSON.stringify(records.filter((x,i,a)=>a.findIndex(y=>y.path===x.path)===i),null,2));
