import test from 'node:test';
import assert from 'node:assert/strict';
import {planRCT2Import,readRCT2Folder} from '../src/lib/rct2-import.ts';
const f=(path,size=10)=>({path,size});
test('preserves RCT2 directory trees and excludes unrelated executables',()=>{
  const plan=planRCT2Import([f('Games/RCT2/DATA/CH.DAT'),f('Games/RCT2/Data/G1.DAT'),f('Games/RCT2/ObjData/ride.dat'),f('Games/RCT2/Scenarios/park.sc6'),f('Games/RCT2/setup.exe')]);
  assert.deepEqual(plan.map(x=>x.path),['/RCT/Data/ch.dat','/RCT/Data/g1.dat','/RCT/ObjData/ride.dat','/RCT/Scenarios/park.sc6']);
});
test('rejects ambiguous roots, traversal, collisions and excess data',()=>{
  for(const extra of [f('other/Data/ch.dat'),f('RCT/../bad'),f('RCT/Data/CH.DAT'),f('RCT/Data/large',512*1024*1024),f('RCT/Data/sub'),f('RCT/Data/ch.dat/child')]){
    const input=[f('RCT/Data/ch.dat'),extra];
    if(extra.path==='RCT/Data/sub')input.push(f('RCT/Data/sub/child'));
    assert.throws(()=>planRCT2Import(input));
  }
  assert.throws(()=>planRCT2Import([f('Data/ch.dat',0)]));
  assert.throws(()=>planRCT2Import([f('Data/other.dat')]));
});
test('validates before reading bytes and never reads excluded files',async()=>{
  let reads=0;
  const file=(path,size=1)=>({name:path,webkitRelativePath:path,size,arrayBuffer:async()=>{reads++;return new Uint8Array(size).buffer;}});
  await assert.rejects(readRCT2Folder([file('RCT/Data/ch.dat'),file('../bad')]));
  assert.equal(reads,0);
  const result=await readRCT2Folder([file('RCT/Data/ch.dat'),file('RCT/setup.exe')]);
  assert.equal(reads,1);
  assert.equal(result[0].path,'/RCT/Data/ch.dat');
});
