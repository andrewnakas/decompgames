import test from 'node:test';
import assert from 'node:assert/strict';
import {validateContainer,readGameFiles} from '../src/lib/imports.ts';
test('rejects renamed executables and truncated containers',()=>{assert.throws(()=>validateContainer('doom.wad',new Uint8Array([77,90])));assert.throws(()=>validateContainer('pak0.pak',new Uint8Array(20)));});
test('rejects WAD directories outside the file',()=>{const bytes=new Uint8Array(12);bytes.set(new TextEncoder().encode('IWAD'));const v=new DataView(bytes.buffer);v.setInt32(4,50,true);v.setInt32(8,12,true);assert.throws(()=>validateContainer('doom.wad',bytes));});
test('empty selection gives an actionable error',async()=>{await assert.rejects(readGameFiles([],'doom'),/Select your game files/);});
test('PWAD alone cannot replace a base IWAD',async()=>{const bytes=new Uint8Array(12);bytes.set(new TextEncoder().encode('PWAD'));new DataView(bytes.buffer).setInt32(8,12,true);await assert.rejects(readGameFiles([new File([bytes],'mod.wad')],'doom'),/base IWAD/);});
test('duplicate basenames are rejected instead of overwritten',async()=>{const bytes=new Uint8Array(12);bytes.set(new TextEncoder().encode('IWAD'));new DataView(bytes.buffer).setInt32(8,12,true);await assert.rejects(readGameFiles([new File([bytes],'DOOM.WAD'),new File([bytes],'doom.wad')],'doom'),/Duplicate/);});
