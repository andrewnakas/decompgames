import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const exec=promisify(execFile);const games=JSON.parse(await readFile('src/data/games.json','utf8'));await mkdir('.cache/research',{recursive:true});
for(const repo of [...new Set(games.map(g=>g.source.replace('https://github.com/','')))]){try{const {stdout}=await exec('gh',['api',`repos/${repo}/readme`,'-H','Accept: application/vnd.github.raw'],{maxBuffer:2e6});await writeFile(`.cache/research/${repo.replace('/','_')}.md`,stdout);const {stdout:meta}=await exec('gh',['api',`repos/${repo}`,'--jq','{url: .html_url, branch: .default_branch, license: .license.spdx_id, archived: .archived}']);console.log(meta.trim());}catch(e){console.log(`${repo}: ${e.message.slice(0,180)}`);}}
