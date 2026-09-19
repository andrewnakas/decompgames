import test from 'node:test';
import assert from 'node:assert/strict';
import { validateBackup } from '../src/lib/saves.ts';
const backup = files => ({format:1,game:'doom',version:'1',files});
const validate = b => validateBackup(b,'doom','1',['/dwasm']);
test('accepts a save within the engine namespace', () => {
  assert.equal(validate(backup([{path:'/dwasm/save.dsg',data:[0,255]}])).files.length,1);
});
test('rejects traversal, adjacent namespaces, duplicate paths and invalid bytes', () => {
  for (const path of ['/dwasm/../other','/dwasm-other/save','/dwasm//save','/dwasm/./save','/dwasm/save\0']) {
    assert.throws(() => validate(backup([{path,data:[0]}])));
  }
  assert.throws(() => validate(backup([{path:'/dwasm/a',data:[256]}])));
  assert.throws(() => validate(backup([{path:'/dwasm/a',data:[]},{path:'/dwasm/a',data:[]}])));
});
test('rejects cross-game and incompatible-version backups before mutation', () => {
  assert.throws(() => validate({...backup([]),game:'quake'}));
  assert.throws(() => validate({...backup([]),version:'2'}));
});

test('rejects file/directory conflicts regardless of file order', () => {
  const files = [{path:'/dwasm/slot',data:[1]},{path:'/dwasm/slot/save.dsg',data:[2]}];
  assert.throws(() => validate(backup(files)), /Conflicting/);
  assert.throws(() => validate(backup(files.toReversed())), /Conflicting/);
  assert.throws(() => validate(backup([{path:'/dwasm/slot/',data:[]}])));
  assert.equal(validate(backup([{path:'/dwasm/slot1',data:[]},{path:'/dwasm/slot10/save',data:[]}])).files.length,2);
});

test('rejects backups beyond the supported file count and byte budget', () => {
  assert.throws(() => validate(backup(Array.from({length:501},(_,i)=>({path:`/dwasm/${i}`,data:[]})))));
  assert.throws(() => validate(backup([{path:'/dwasm/large',data:new Array(8*1024*1024+1).fill(0)}])), /8 MB/);
});
