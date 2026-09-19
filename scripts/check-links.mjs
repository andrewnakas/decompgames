import {readFile,readdir,stat} from 'node:fs/promises';
import {resolve,join} from 'node:path';
const root=resolve('dist');
async function walk(dir){return (await Promise.all((await readdir(dir,{withFileTypes:true})).map(e=>e.isDirectory()?walk(join(dir,e.name)):join(dir,e.name)))).flat();}
let checked=0;const failures=[];
for(const path of (await walk(root)).filter(p=>p.endsWith('.html'))){
 const html=await readFile(path,'utf8');
 for(const match of html.matchAll(/(?:href|src)="(\/[^"#?]*)[^\"]*"/g)){
  const url=decodeURIComponent(match[1]);if(/^\/(runtime|data|sources)\//.test(url))continue;
  const target=join(root,url);checked++;
  try{const s=await stat(target);if(s.isDirectory())await stat(join(target,'index.html'));}catch{failures.push(`${path}: ${url}`);}
 }
}
if(failures.length)throw Error(failures.join('\n'));
console.log(`Checked ${checked} local links and assets.`);
