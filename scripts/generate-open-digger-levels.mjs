// Original Digger-compatible campaign layouts. Generated data is CC0-1.0.
// The level alphabet and dimensions are engine interface facts; no original
// map rows are read or copied.
import {createHash} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';

const output=resolve(process.argv[2]||'.cache/open-digger-levels');
await mkdir(output,{recursive:true});
const width=15,height=10,levels=[];

for(let level=0;level<8;level++) {
  const grid=Array.from({length:height},()=>Array(width).fill(' '));
  // A connected top route and central shaft give both starting positions a
  // route into the field. Later levels add offset cross-routes.
  grid[0]='SHHHHHHHHHHHHHS'.split('');
  const shaft=3+(level*2)%9;
  for(let y=1;y<height;y++)grid[y][shaft]='V';
  for(const row of [2+(level%3),6+(level%2)])for(let x=0;x<width;x++)grid[row][x]='H';
  for(let y=1;y<height;y++)for(let x=0;x<width;x++) {
    if(grid[y][x]!==' ')continue;
    if((x*3+y*5+level)%7===0)grid[y][x]='C';
  }
  for(const [x,y] of [[2+(level%4),5],[12-(level%4),8]])if(grid[y][x]===' ')grid[y][x]='B';
  const rows=grid.map(row=>row.join(''));
  if(rows.some(row=>row.length!==width||!/^[ BCHSV]+$/.test(row)))throw Error('Invalid generated Digger row');
  levels.push({number:level+1,rows});
}

const initializer=`{\n${levels.map(level=>`  {${level.rows.map(row=>JSON.stringify(row)).join(',\n   ')}}`).join(',\n ')}\n}`;
const bytes=Buffer.from(initializer+'\n');
await writeFile(resolve(output,'open-levels.inc'),bytes);
await writeFile(resolve(output,'manifest.json'),JSON.stringify({
  license:'CC0-1.0',originalAssetsUsed:false,engineTested:false,
  dimensions:{width,height},alphabet:[' ','B','C','H','S','V'],levels,
  limitations:['Layouts are structurally valid but not yet play-tested','Difficulty and completion paths require gameplay verification'],
  file:{name:'open-levels.inc',bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')}
},null,2)+'\n');
console.log(`Generated ${levels.length} original Digger-compatible layouts in ${output}.`);
