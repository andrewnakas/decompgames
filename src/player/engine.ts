import {validateBackup} from '../lib/saves';
import {loadAssets} from '../lib/assets';
import {installAudioGate} from '../lib/audio';
const audioGate=installAudioGate(AudioNode.prototype);
type FSApi={mkdirTree:(p:string)=>void;writeFile:(p:string,b:Uint8Array)=>void;readFile:(p:string)=>Uint8Array;readdir:(p:string)=>string[];stat:(p:string)=>{mode:number};isDir:(m:number)=>boolean;unlink:(p:string)=>void;mount:(fs:unknown,opts:object,p:string)=>void;syncfs:(populate:boolean,callback:(e:unknown)=>void)=>void;analyzePath:(p:string)=>{exists:boolean};getMounts:(m:unknown)=>{mountpoint:string;type:unknown}[];root:{mount:unknown}};
type EmscriptenModule={FS:FSApi;IDBFS:{getDB?:(name:string,cb:unknown)=>unknown};[key:string]:any};
export {};
declare global{interface Window{Module:EmscriptenModule}}
const canvas=document.querySelector<HTMLCanvasElement>('#canvas')!;
const message=document.querySelector<HTMLElement>('#engine-message')!;
const game=new URLSearchParams(location.search).get('game')||'';
const origins=new Set([location.origin]);let started=false,saveRoots:string[]=[],saveVersion='1';
function send(type:string,props:Record<string,unknown>={}){parent.postMessage({type,...props},location.origin);}
function status(text:string){if(text){message.textContent=text;send('status',{message:text});}}
function fail(error:unknown){const text=error instanceof Error?error.message:String(error);message.textContent=text;send('error',{message:text});}
function sync(){return new Promise<void>((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Browser storage did not respond. Export a backup before closing.')),10000);window.Module.FS.syncfs(false,e=>{clearTimeout(timeout);e?reject(Error('Browser storage could not save your progress. Export a backup.')):resolve();});});}
function walk(dir:string):{path:string;data:number[]}[]{const fs=window.Module.FS;if(!fs.analyzePath(dir).exists)return[];return fs.readdir(dir).filter(n=>n!=='.'&&n!=='..').flatMap(n=>{const path=`${dir}/${n}`;return fs.isDir(fs.stat(path).mode)?walk(path):[{path,data:Array.from(fs.readFile(path))}];});}
async function load(assets:{name:string;bytes:Uint8Array}[]){
 const response=await fetch(`/manifests/${game}.json`);if(!response.ok)throw Error('This runtime has not been released yet. Return to the game guide for its current status.');const config=await response.json();saveVersion=config.saveVersion;saveRoots=config.saveRoots;
 const base=config.base;
 const loaded=await loadAssets(base,config.assets||[],(done,total)=>status(`Downloading game files ${done}/${total}…`));
 const args=[...(config.args||[])];if(config.engine==='doom'&&assets.length){const baseWad=assets.find(a=>new TextDecoder().decode(a.bytes.subarray(0,4))==='IWAD')!;args.push('-iwad',`/${baseWad.name}`);const mods=assets.filter(a=>a!==baseWad);if(mods.length)args.push('-file',...mods.map(a=>`/${a.name}`));}
 const module:any={canvas,arguments:args,locateFile:(name:string)=>base+name,setStatus:status,print:console.log,printErr:console.warn,onAbort:(text:string)=>fail(`Engine stopped: ${text}`),captureMouse:()=>{canvas.focus();},preRun:[()=>{const fs=window.Module.FS;const idb=window.Module.IDBFS;if(idb?.getDB){const original=idb.getDB.bind(idb);idb.getDB=(name:string,cb:unknown)=>original(`decompgames:${game}:${saveVersion}:${name}`,cb);}
 for(const item of loaded){fs.mkdirTree(item.path.slice(0,item.path.lastIndexOf('/'))||'/');fs.writeFile(item.path,item.bytes);}for(const item of assets){const path=config.engine==='quake'?`/id1/${item.name}`:`/${item.name}`;fs.mkdirTree(path.slice(0,path.lastIndexOf('/'))||'/');fs.writeFile(path,item.bytes);}
 if(config.mountSave){for(const dir of saveRoots){fs.mkdirTree(dir);fs.mount(idb,{},dir);}module.addRunDependency('restore-saves');fs.syncfs(true,e=>{if(e)status('Browser storage unavailable; export saves before closing.');module.removeRunDependency('restore-saves');});}
 }],postRun:[()=>{message.textContent='';send('ready');canvas.focus();}],onRuntimeInitialized:()=>{status('Starting game…');}};
 module.onBootstrap=(done:number,total:number)=>status(`Preparing game files ${done}/${total}…`);
 module.onBootstrapFailed=()=>fail('Game setup failed. Check browser storage and try again.');
 module.onBootstrapReload=()=>send('stopped',{message:'Game files prepared. Start again to finish setup.'});
 module.onWarningFs=()=>status('Progress is stored in this browser. Export a backup before clearing site data.');
 module.onExit=async()=>{try{await sync();send('stopped',{message:'Game exited. Local saves synchronized. Start again when you are ready.'});}catch{send('operation-error',{message:'Game exited, but browser storage did not save. Export a backup before closing.'});}};
 // Emscripten prepends preRun callbacks. Keep our namespace setup before upstream mounts.
 module.preRun.push=function(...callbacks:unknown[]){return Array.prototype.unshift.apply(this,callbacks);};
 window.Module=module;
 window.addEventListener('error',e=>fail(e.message));
 window.addEventListener('unhandledrejection',e=>{if(e.reason instanceof DOMException){send('status',{message:'A browser feature could not initialize. Gameplay may continue; export a backup before closing.'});}else fail(e.reason);});
 const script=document.createElement('script');script.src=base+config.script;script.onerror=()=>fail('Engine download failed. Check your connection and retry.');document.body.append(script);
 setInterval(()=>{if(module.FS)sync().catch(()=>send('status',{message:'Browser storage could not retain progress. Export saves before closing.'}));},15000);
}
window.addEventListener('message',async event=>{if(event.source!==parent||!origins.has(event.origin))return;try{const msg=event.data;if(msg?.type==='audio'){audioGate.setMuted(msg.muted!==false);return;}if(msg?.type==='start'&&!started&&msg.game===game){started=true;await load(msg.assets||[]);}else if(msg?.type==='stop'){await sync();send('stopped');}else if(msg?.type==='export'){send('save-export',{backup:{format:1,game,version:saveVersion,files:saveRoots.flatMap(walk)}});}else if(msg?.type==='delete'||msg?.type==='import'){if(msg.type==='import')validateBackup(msg.backup,game,saveVersion,saveRoots);const fs=window.Module.FS;for(const f of saveRoots.flatMap(walk))fs.unlink(f.path);if(msg.type==='import')for(const f of msg.backup.files){fs.mkdirTree(f.path.slice(0,f.path.lastIndexOf('/')));fs.writeFile(f.path,new Uint8Array(f.data));}await sync();send('stopped',{message:'Saved data updated. Start the game to reload it.'});}}catch(error){if(event.data?.type==='start')fail(error);else send('operation-error',{message:error instanceof Error?error.message:'Save operation failed. Export a backup before closing.'});}});
canvas.addEventListener('click',()=>{canvas.focus();const ctx=window.Module?.SDL2?.audioContext;ctx?.resume?.();});
send('shell-ready');
