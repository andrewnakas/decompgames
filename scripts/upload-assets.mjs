import {readFile,readdir,stat,writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
const account='ea509cdff27d40d5e3e4cb92dec2473f', bucket='decompgames-assets';
const config=await readFile(join(process.env.APPDATA,'xdg.config/.wrangler/config/default.toml'),'utf8');
const token=config.match(/oauth_token\s*=\s*"([^"]+)"/)?.[1];
if(!token)throw Error('Run wrangler whoami to refresh authentication.');
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
 const url=`https://api.cloudflare.com/client/v4/accounts/${account}/r2/buckets/${bucket}/objects/${key.split('/').map(encodeURIComponent).join('/')}`;
 const response=await fetch(url,{method:'PUT',headers:{Authorization:`Bearer ${token}`,'Content-Type':types[key.split('.').pop()]||'application/octet-stream'},body:bytes});
 if(!response.ok)throw Error(`Upload failed for ${key}: ${response.status} ${await response.text()}`);
 done[key]=digest;await writeFile('.cache/uploads.json',JSON.stringify(done,null,2));
 console.log(`${key} (${(size/1048576).toFixed(1)} MiB)`);
}
console.log(`Uploaded ${Object.keys(done).length} versioned assets and notices.`);
