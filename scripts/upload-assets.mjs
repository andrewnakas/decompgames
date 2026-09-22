import {readFile,readdir,stat,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const bucket='decompgames-assets';
const keys=new Set();
for(const file of await readdir('public/manifests')){
 const manifest=JSON.parse(await readFile(`public/manifests/${file}`,'utf8'));
 keys.add(manifest.sourceArchive.slice(1));
 for(const f of manifest.files)keys.add((manifest.base+f.path).slice(1));
 for(const f of manifest.assets||[])keys.add(decodeURIComponent(new URL(manifest.base+f.url,'https://decompgames.com').pathname.slice(1)));
}
// Publish accompanying license notices with the complete original data directories.
async function walk(dir){for(const file of await readdir(dir,{withFileTypes:true})){const path=`${dir}/${file.name}`;if(file.isDirectory())await walk(path);else keys.add(path.slice(7));}}
await walk('public/data');
await mkdir('.cache',{recursive:true});
let done={};try{done=JSON.parse(await readFile('.cache/uploads.json','utf8'));}catch{}
const types={wasm:'application/wasm',js:'text/javascript',gz:'application/gzip',txt:'text/plain',json:'application/json'};
for(const key of keys){
 const path=`public/${key}`;const size=(await stat(path)).size;
 const bytes=await readFile(path);const digest=createHash('sha256').update(bytes).digest('hex');
 if(done[key]===digest)continue;
 execFileSync(process.execPath,['node_modules/wrangler/bin/wrangler.js','r2','object','put',`${bucket}/${key}`,'--file',path,'--content-type',types[key.split('.').pop()]||'application/octet-stream','--remote','--force'],{stdio:'inherit'});
 done[key]=digest;await writeFile('.cache/uploads.json',JSON.stringify(done,null,2));
 console.log(`${key} (${(size/1048576).toFixed(1)} MiB)`);
}
console.log(`Uploaded ${Object.keys(done).length} versioned assets and notices.`);
