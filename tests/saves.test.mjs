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
