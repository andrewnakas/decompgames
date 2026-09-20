import {mkdir,copyFile,readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const linuxRoot=process.env.DECOMP_BUILD_ROOT||'/home/nakas/decompgames-build';
const root=process.platform==='win32'?`\\\\wsl.localhost\\Ubuntu${linuxRoot.replaceAll('/','\\')}`:linuxRoot;
const command=(cmd,args)=>process.platform==='win32'?execFileSync('wsl',['-e',cmd,...args],{encoding:'utf8'}):execFileSync(cmd,args,{encoding:'utf8'});
const targets={
 cadet:{repo:'pinball-web',upstream:'alula/SpaceCadetPinball',dir:'pinball-web/bin',stem:'SpaceCadetPinball',game:'open-cadet',saveRoots:['/libsdl'],mountSave:true},
 quake:{repo:'quake',upstream:'GMH-Code/Qwasm',dir:'quake/WinQuake',stem:'index',game:'quake',saveRoots:['/qwasm']},
 doom:{repo:'doom',upstream:'GMH-Code/Dwasm',dir:'doom/build',stem:'index',game:'doom',saveRoots:['/dwasm']},
 scummvm:{repo:'scummvm',upstream:'scummvm/scummvm',dir:'scummvm',stem:'scummvm',game:'scummvm',saveRoots:['/home/web_user']},
 tyrian:{repo:'tyrian',upstream:'midzer/opentyrian',dir:'tyrian',stem:'index',game:'opentyrian',saveRoots:['/home/web_user/.config/opentyrian'],mountSave:true},
 openttd:{repo:'openttd',upstream:'OpenTTD/OpenTTD',dir:'openttd/build',stem:'openttd',game:'openttd',saveRoots:['/home/web_user/.openttd'],toolchain:'6.0.1'}
};
for(const key of process.argv.slice(2)){
 const t=targets[key];if(!t)throw Error('Unknown engine');const rev=command('git',['-C',`${linuxRoot}/${t.repo}`,'rev-parse','HEAD']).trim();
 const files=[];for(const ext of ['js','wasm','data']){const name=`${t.stem}.${ext}`;try{const bytes=await readFile(`${root}/${t.dir}/${name}`);files.push({path:name,sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length});}catch(e){if(ext!=='data')throw e;}}
 const digest=createHash('sha256').update(JSON.stringify(files)).digest('hex').slice(0,10);const packageRevision=`${rev.slice(0,12)}-${digest}`;const base=`/runtime/${key}/${packageRevision}/`;const out='public'+base;
 await mkdir(out,{recursive:true});await mkdir('public/manifests',{recursive:true});await mkdir('public/sources',{recursive:true});
 for(const f of files)await copyFile(`${root}/${t.dir}/${f.path}`,out+f.path);
 const sourceName=`${key}-${packageRevision}`;const archive=`${linuxRoot}/${sourceName}.tar`;
 command('git',['-C',`${linuxRoot}/${t.repo}`,'archive','--format=tar',`--output=${archive}`,'HEAD']);
 const patch=command('git',['-C',`${linuxRoot}/${t.repo}`,'diff','--binary']);await writeFile(`${root}/decompgames.patch`,patch);
 await writeFile(`${root}/BUILD-DECOMPGAMES.txt`,`Engine: ${t.upstream}\nRevision: ${rev}\nEmscripten: ${t.toolchain||'4.0.10'}\nApply decompgames.patch with git apply. See build-engines.sh and patch-engines.py from the Decomp Games source repository for build flags and asset layout. Game data is distributed separately under its own terms.\n`);
 await copyFile('scripts/build-engines.sh',`${root}/build-engines.sh`);await copyFile('scripts/patch-engines.py',`${root}/patch-engines.py`);
 command('tar',['-rf',archive,'-C',linuxRoot,'decompgames.patch','BUILD-DECOMPGAMES.txt','build-engines.sh','patch-engines.py']);command('gzip',['-f',archive]);await copyFile(`${root}/${sourceName}.tar.gz`,`public/sources/${sourceName}.tar.gz`);
 const manifest={id:key,engine:key,packageRevision,sourceRevision:rev,repository:`https://github.com/${t.upstream}`,toolchain:`Emscripten ${t.toolchain||'4.0.10'}`,recipe:'scripts/build-engines.sh',sourceArchive:`/sources/${sourceName}.tar.gz`,requirements:['WebAssembly','Keyboard and mouse'],files,base,script:`${t.stem}.js`,saveVersion:'1',saveRoots:t.saveRoots,mountSave:!!t.mountSave,assets:[],args:[]};
 const sourceBytes=await readFile(`public${manifest.sourceArchive}`);
 const releaseManifest={...manifest,sourceArchiveSha256:createHash('sha256').update(sourceBytes).digest('hex'),sourceArchiveBytes:sourceBytes.length};
 await writeFile(`public/manifests/${t.game}.json`,JSON.stringify(releaseManifest,null,2));console.log(`${t.game}: ${packageRevision} (${files.reduce((n,f)=>n+f.bytes,0)} bytes)`);
}
