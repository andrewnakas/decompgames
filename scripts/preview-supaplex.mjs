// Local-only integration harness. Never copies upstream data into deployment directories.
import {createServer} from 'node:http';
import {readFile, readdir, stat} from 'node:fs/promises';
import {resolve, sep, extname} from 'node:path';
import {createHash} from 'node:crypto';
const [checkout, build] = process.argv.slice(2).map(p => resolve(p));
if (!checkout || !build) throw Error('Usage: node scripts/preview-supaplex.mjs CHECKOUT BUILD');
const dataRoot=resolve(checkout,'resources'), dist=resolve('dist');
const assets=[];
async function scan(dir, prefix='') {
  for(const entry of await readdir(dir,{withFileTypes:true})) {
    const name=prefix+entry.name, path=resolve(dir,entry.name);
    if(entry.isDirectory()) await scan(path,name+'/');
    else if(entry.isFile()) assets.push({path:'/games/supaplex/'+name,url:'../../../supaplex-test-data/'+name.split('/').map(encodeURIComponent).join('/'),sha256:createHash('sha256').update(await readFile(path)).digest('hex')});
  }
}
await scan(dataRoot);
const manifest={engine:'supaplex',saveVersion:'experimental-1',saveRoots:['/home/web_user/.local/share/OpenSupaplex'],mountSave:true,base:'/runtime/supaplex/experiment/',script:'supaplex.js',assets,args:[]};
const page=(await readFile(resolve(dist,'play/opentyrian/index.html'),'utf8')).replaceAll('opentyrian','supaplex').replaceAll('OpenTyrian','OpenSupaplex (local test)').replace('No original game files needed.','Local developer data only. Not a public release.').replace('Approximately 15 MB. Keyboard and mouse recommended.','Experimental engine: controls, timing and saves need verification.');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.wasm':'application/wasm','.json':'application/json','.svg':'image/svg+xml'};
createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,'http://localhost');
    res.setHeader('Cache-Control','no-store');
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
    let body, type;
    if(url.pathname==='/play/supaplex/') {body=page;type='text/html';}
    else if(url.pathname==='/manifests/supaplex.json') {body=JSON.stringify(manifest);type='application/json';}
    else {
      let base=dist, relative=url.pathname;
      if(relative.startsWith('/runtime/supaplex/experiment/')) {base=build;relative=relative.slice('/runtime/supaplex/experiment/'.length);}
      else if(relative.startsWith('/supaplex-test-data/')) {base=dataRoot;relative=relative.slice('/supaplex-test-data/'.length);}
      let path=resolve(base,decodeURIComponent(relative).replace(/^\//,''));
      if(path!==base&&!path.startsWith(base+sep)) throw Error('Invalid path');
      if((await stat(path)).isDirectory()) path=resolve(path,'index.html');
      body=await readFile(path);type=mime[extname(path)]||'application/octet-stream';
    }
    res.setHeader('Content-Type',type);res.end(req.method==='HEAD'?undefined:body);
  } catch {res.writeHead(404);res.end('Not found');}
}).listen(4323,'127.0.0.1',()=>console.log('Muted test harness: http://127.0.0.1:4323/play/supaplex/'));

