import test from 'node:test';
import assert from 'node:assert/strict';
import {validateZelda3Assets, readZelda3Files, MAX_ZELDA3_BYTES} from '../src/lib/zelda3.ts';
// Synthetic container only, containing no game data. Structural validity does not prove playable assets.
function fixture() {
  const bytes = new Uint8Array(752);
  bytes.set([90,101,108,100,97,51,95,118,48,32,32,32,32,32,10,0,27,174,233,45,74,174,252,50,49,27,153,197,27,43,216,197,132,101,173,169,36,108,15,155,176,169,57,131,174,101,51,207]);
  const view = new DataView(bytes.buffer);
  view.setUint32(80,165,true);
  view.setUint32(88,1,true);
  return bytes;
}
test('Zelda container validation respects byte views and alignment', () => {
  const outer = new Uint8Array(800); outer.set(fixture(),16);
  validateZelda3Assets(outer.subarray(16,768));
  assert.throws(()=>validateZelda3Assets(fixture().subarray(0,750)),/extends/);
});
test('Zelda rejects mismatched revisions, truncated headers and overflowing ranges', () => {
  assert.throws(()=>validateZelda3Assets(new Uint8Array(40)));
  for (const offset of [80,84,88]) {
    const bytes = fixture(); new DataView(bytes.buffer).setUint32(offset,0xffffffff,true);
    assert.throws(()=>validateZelda3Assets(bytes));
  }
  const bytes=fixture(); bytes[20]^=1; assert.throws(()=>validateZelda3Assets(bytes));
});
test('Zelda file import normalizes names and rejects wrong selection before reading', async () => {
  const result=await readZelda3Files([new File([fixture()],'ZELDA3_ASSETS.DAT')]);
  assert.equal(result[0].name,'zelda3_assets.dat');
  await assert.rejects(readZelda3Files([]),/Choose one/);
  await assert.rejects(readZelda3Files([new File([],'zelda3.sfc')]),/Choose one/);
  await assert.rejects(readZelda3Files([{name:'zelda3_assets.dat',size:MAX_ZELDA3_BYTES+1,arrayBuffer(){throw Error('must not read');}}]),/32 MB/);
});
