import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {loadAssets} from '../src/lib/assets.ts';

test('downloads in bounded parallel batches and retains manifest order', async t => {
  let active = 0, peak = 0;
  const progress = [];
  t.mock.method(globalThis, 'fetch', async url => {
    active++; peak = Math.max(peak, active);
    const index = Number(url.split('/').pop());
    await new Promise(resolve => setTimeout(resolve, index % 2 ? 1 : 10));
    active--;
    return new Response(new Uint8Array([index]));
  });
  const entries = Array.from({length:9}, (_, i) => ({path:`/data/${i}`,url:String(i)}));
  const loaded = await loadAssets('/runtime/', entries, done => progress.push(done));
  assert.equal(peak, 4);
  assert.deepEqual(loaded.map(x => x.path), entries.map(x => x.path));
  assert.deepEqual(loaded.map(x => x.bytes[0]), [0,1,2,3,4,5,6,7,8]);
  assert.deepEqual(progress, [0,1,2,3,4,5,6,7,8,9]);
});

test('checks asset hashes and rejects corruption before returning files', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response('game data'));
  const entry = {path:'/data/game',url:'game',sha256:createHash('sha256').update('game data').digest('hex')};
  assert.equal((await loadAssets('/', [entry], () => {})).length, 1);
  await assert.rejects(loadAssets('/', [{...entry,sha256:'0'.repeat(64)}], () => {}), /checksum failed/);
});

test('aborts pending downloads after failure and reports the failed asset', async t => {
  let requests = 0, aborted = 0;
  t.mock.method(globalThis, 'fetch', async (url, {signal}) => {
    requests++;
    if (url === '/missing') {
      await new Promise(resolve => setTimeout(resolve, 1));
      return new Response('', {status:404});
    }
    return new Promise((_, reject) => signal.addEventListener('abort', () => {
      aborted++;
      reject(signal.reason);
    }, {once:true}));
  });
  const entries = [{path:'/missing',url:'missing'}, ...Array.from({length:8}, (_,i) => ({path:`/data/${i}`,url:String(i)}))];
  await assert.rejects(loadAssets('/', entries, () => {}), /404.*missing/);
  assert.equal(requests, 4);
  assert.equal(aborted, 3);
});
