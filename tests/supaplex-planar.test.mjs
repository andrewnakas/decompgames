import test from 'node:test';
import assert from 'node:assert/strict';
import {encodePlanar,decodePlanar} from '../scripts/lib/supaplex-planar.mjs';
test('planar encoder matches independently calculated bit-plane bytes',()=>{
  // Colors 0,1,2,3,4,5,6,7 -> low planes 01010101,00110011,00001111,00000000.
  assert.deepEqual([...encodePlanar([0,1,2,3,4,5,6,7],8,1)],[0x55,0x33,0x0f,0]);
  assert.deepEqual([...decodePlanar(new Uint8Array([0x55,0x33,0x0f,0xff]),8,1)],[8,9,10,11,12,13,14,15]);
});
test('bitmap rows keep their own planes and reject invalid inputs',()=>{
  assert.deepEqual([...encodePlanar([...Array(8).fill(1),...Array(8).fill(8)],8,2)],[255,0,0,0,0,0,0,255]);
  assert.throws(()=>encodePlanar(Array(8).fill(16),8,1));
  assert.throws(()=>encodePlanar(Array(7).fill(0),7,1));
  assert.throws(()=>decodePlanar(new Uint8Array(3),8,1));
});
