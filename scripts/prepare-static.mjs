import {mkdir,cp,readdir} from 'node:fs/promises';
await mkdir('static',{recursive:true});
for(const name of await readdir('public')){if(['runtime','data','sources'].includes(name))continue;await cp(`public/${name}`,`static/${name}`,{recursive:true});}
console.log('Prepared static shell; runtime, data, and source archives stay in object storage.');
