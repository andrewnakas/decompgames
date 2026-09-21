// Local-only integration harness. Never copies upstream data into deployment directories.
import {createServer} from 'node:http';
import {readFile, stat} from 'node:fs/promises';
import {resolve, sep, extname} from 'node:path';
import {createHash} from 'node:crypto';
const [buildArg] = process.argv.slice(2);
if (!buildArg) throw Error('Usage: node scripts/preview-zelda3.mjs BUILD');
const build=resolve(buildArg), dist=resolve('dist');
const ini=Buffer.from('[Graphics]\nOutputMethod = SDL-Software\nWindowScale = 2\n');
const manifest={engine:'zelda3',saveVersion:'experimental-1',saveRoots:['/saves'],mountSave:true,base:'/runtime/zelda3/experiment/',script:'zelda3.js',assets:[{path:'/zelda3.ini',url:'zelda3.ini',sha256:createHash('sha256').update(ini).digest('hex')}],args:['--config','/zelda3.ini']};
let page=await readFile(resolve(dist,'play/doom/index.html'),'utf8');
page=page.replaceAll('doom','zelda3').replaceAll('Doom','Zelda3 (local experiment)')
  .replace('accept=".wad,.pak,.zip"','accept=".dat"')
  .replace('Choose files or ZIP','Choose zelda3_assets.dat')
  .replace(/<label class="button">Choose a folder[\s\S]*?<\/label>/,'')
  .replace(/<details class="player-help">[\s\S]*?<\/details>/,'<p>Experimental local-file adapter. Gameplay and saves are unverified. Use assets extracted with the pinned upstream version. No ROM data is included.</p>')
  .replace(/<h2>[\s\S]*?<\/h2><p>[\s\S]*?<\/p>/,'<h2>Zelda3 (local experiment)</h2><p>Select your extracted zelda3_assets.dat. Raw ROM and ZIP import are not supported here.</p>')
  .replace(/<p class="small-note">[\s\S]*?<\/p>/,'<p class="small-note">Engine: about 2.4 MB. Sound stays off.</p>');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.wasm':'application/wasm','.json':'application/json','.svg':'image/svg+xml'};
createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,'http://localhost');
    res.setHeader('Cache-Control','no-store');
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
    let body, type;
    if(url.pathname==='/runtime/zelda3/experiment/zelda3.ini'){res.setHeader('Content-Type','text/plain');res.end(req.method==='HEAD'?undefined:ini);return;}
    if(url.pathname==='/play/zelda3/') {body=page;type='text/html';}
    else if(url.pathname==='/manifests/zelda3.json') {body=JSON.stringify(manifest);type='application/json';}
    else {
      let base=dist, relative=url.pathname;
      if(relative.startsWith('/runtime/zelda3/experiment/')) {base=build;relative=relative.slice('/runtime/zelda3/experiment/'.length);}
      
      let path=resolve(base,decodeURIComponent(relative).replace(/^\//,''));
      if(path!==base&&!path.startsWith(base+sep)) throw Error('Invalid path');
      if((await stat(path)).isDirectory()) path=resolve(path,'index.html');
      body=await readFile(path);type=mime[extname(path)]||'application/octet-stream';
    }
    res.setHeader('Content-Type',type);res.end(req.method==='HEAD'?undefined:body);
  } catch {res.writeHead(404);res.end('Not found');}
}).listen(4324,'127.0.0.1',()=>console.log('Muted test harness: http://127.0.0.1:4324/play/zelda3/'));


