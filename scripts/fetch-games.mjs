import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {unzipSync} from 'fflate';
import {createHash} from 'node:crypto';
import {dirname} from 'node:path';
const base='https://raw.githubusercontent.com/andrewnakas/exebrowser/c6049f9684f3c6895c8f31f361a0a29462793f41/public/';
async function download(url,path){await mkdir(dirname(path),{recursive:true});let bytes;try{bytes=await readFile(path);}catch{const r=await fetch(url);if(!r.ok)throw Error(`${r.status} ${url}`);bytes=Buffer.from(await r.arrayBuffer());await writeFile(path,bytes);}return bytes;}
const treeUrl='https://api.github.com/repos/andrewnakas/exebrowser/git/trees/c6049f9684f3c6895c8f31f361a0a29462793f41?recursive=1';
const tree=JSON.parse((await download(treeUrl,'.cache/reference/exebrowser-tree.json')).toString('utf8'));
if(tree.truncated || !Array.isArray(tree.tree)) throw Error('The pinned asset tree is incomplete. No assets were copied.');
const records=[];
for(const f of tree.tree.filter(f=>f.type==='blob'&&/^public\/data\/games\/(bass|lure|queen|soltys)\//.test(f.path))){const path=f.path;const bytes=await download(base+path.slice(7),path);records.push({path:path.slice(7),url:base+path.slice(7),bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});}
const zip=await download('https://github.com/freedoom/freedoom/releases/download/v0.13.0/freedoom-0.13.0.zip','.cache/freedoom-0.13.0.zip');
for(const [name,bytes] of Object.entries(unzipSync(zip))){if(!/freedoom[12]\.wad$|COPYING$|CREDITS$/.test(name))continue;const path=`public/data/freedoom/${name.split('/').pop()}`;await mkdir(dirname(path),{recursive:true});await writeFile(path,bytes);records.push({path:path.slice(7),url:'https://github.com/freedoom/freedoom/releases/tag/v0.13.0',bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});}
await mkdir('provenance',{recursive:true});await writeFile('provenance/assets.json',JSON.stringify(records,null,2));
console.log(`Downloaded and recorded ${records.length} assets.`);
