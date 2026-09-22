// Independently authored maze layouts. No original game asset input or network access.
import {mkdir, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
const out=resolve(process.argv[2]||'.cache/open-puzzles');
await mkdir(out,{recursive:true});
const records=[];
for(let n=1;n<=6;n++) {
  const width=60,height=24,tiles=new Uint8Array(width*height).fill(6);
  let state=n*7919;
  const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state;};
  let exit;
  if(n===1) {
    // Deterministic release-gate loop: two steps from spawn to an open exit.
    // Later levels retain the longer generated maze format.
    for(let x=1;x<=3;x++)tiles[width+x]=2;
    exit=width+3;
  } else {
    // A bounded perfect maze, surrounded by indestructible wall tiles.
    const stack=[[1,1]],seen=new Set(['1,1']); tiles[61]=2;
    while(stack.length) {
      const [x,y]=stack.at(-1);
      const options=[[2,0],[-2,0],[0,2],[0,-2]].filter(([dx,dy])=>x+dx>0&&x+dx<20&&y+dy>0&&y+dy<14&&!seen.has(`${x+dx},${y+dy}`));
      if(!options.length){stack.pop();continue;}
      const [dx,dy]=options[random()%options.length],nx=x+dx,ny=y+dy;
      tiles[(y+dy/2)*width+x+dx/2]=2; tiles[ny*width+nx]=2;
      seen.add(`${nx},${ny}`);stack.push([nx,ny]);
    }
    exit=13*width+19;
  }
  tiles[61]=3;
  tiles[exit]=7;
  // No falling objects, enemies, or required infotrons in these traversal prototypes.
  // BFS verifies a path through only base/space tiles; actual engine completion is separate.
  const queue=[61],previous=new Map([[61,null]]);
  for(let i=0;i<queue.length&&!previous.has(exit);i++)for(const next of [queue[i]-1,queue[i]+1,queue[i]-width,queue[i]+width]) {
    if(next>=0&&next<tiles.length&&tiles[next]!==6&&!previous.has(next)){previous.set(next,queue[i]);queue.push(next);}
  }
  if(!previous.has(exit))throw Error('Unreachable exit');
  const reverseMoves=[];
  for(let p=exit;p!==61;p=previous.get(p)) {
    const parent=previous.get(p),delta=p-parent;
    reverseMoves.push(delta===1?'R':delta===-1?'L':delta===width?'D':'U');
  }
  const solutionMoves=reverseMoves.reverse().join('');
  const data=Buffer.alloc(1536);data.set(tiles);
  const name=`OPEN PATH ${String(n).padStart(2,'0')}`;
  data.fill(32,1446,1469);data.write(name,1446,'ascii');
  const file=`open-path-${n}.sp`;
  await writeFile(resolve(out,file),data);
  records.push({file,name,bytes:data.length,sha256:createHash('sha256').update(data).digest('hex'),shortestPathSteps:solutionMoves.length,solutionMoves,engineTested:false});
}
await writeFile(resolve(out,'manifest.json'),JSON.stringify({license:'CC0-1.0',source:'scripts/generate-open-puzzles.mjs',originalAssetsUsed:false,scope:'Six-level Open Paths navigation campaign. Levels intentionally exclude collectibles, hazards and enemies.',levels:records},null,2)+'\n');
console.log(JSON.stringify(records,null,2));
