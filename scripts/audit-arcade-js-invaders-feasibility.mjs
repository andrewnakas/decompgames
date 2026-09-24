// Inspect ROM-data dependencies without possessing or loading the original ROM.
// This is a feasibility probe, never a gameplay or compatibility test.
// Usage: node scripts/audit-arcade-js-invaders-feasibility.mjs PATH_TO_PINNED_ARCADE_JS
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const checkout = resolve(process.argv[2] || '');
if (!process.argv[2]) throw new Error('Pass the pinned arcade-js checkout path');
const expected = 'e849d086f4168c9a0e1ab501d62efbe3766def8a';
const actual = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: checkout, encoding: 'utf8' }).trim();
if (actual !== expected) throw new Error(`Expected arcade-js ${expected}, got ${actual}`);
const moduleAt = (path) => import(pathToFileURL(join(checkout, path)).href);
const { Machine, resolveAllIdiomatic } = await moduleAt('games/invaders/machine.js');
const { runIdiomaticGame } = await moduleAt('core/frame-stepped.js');
const { ATTRACT_DEMO_PTR, GAME_ACTIVE } = await moduleAt('games/invaders/idiomatic/names.js');
const manifest = (await moduleAt('games/invaders/manifest.js')).default;

// Zeroes are a deliberately nonfunctional stand-in, not reconstructed data.
const machine = await Machine.create(new Uint8Array(8192), {
  overrides: await resolveAllIdiomatic(),
});
const reads = new Uint32Array(8192);
const read8 = machine.mem.read8.bind(machine.mem);
machine.mem.read8 = (address) => {
  const masked = address & 0x7fff;
  if (masked < reads.length) reads[masked]++;
  return read8(address);
};
const result = runIdiomaticGame(machine, {
  nmiReturnPC: manifest.convergence.idiomatic.nmiReturnPC,
  maxFrames: 200,
});
const ranges = [];
for (let i = 0; i < reads.length;) {
  if (!reads[i]) { i++; continue; }
  const start = i;
  let count = 0;
  while (i < reads.length && reads[i]) count += reads[i++];
  ranges.push({
    start: `0x${start.toString(16).padStart(4, '0')}`,
    end: `0x${(i - 1).toString(16).padStart(4, '0')}`,
    reads: count,
  });
}
console.log(JSON.stringify({
  upstreamRevision: actual,
  inputData: '8,192 zero bytes; no original ROM',
  frames: result.frames,
  stop: result.stop,
  stopError: result.stopError ? String(result.stopError) : null,
  attractDemoPtr: machine.mem8[ATTRACT_DEMO_PTR],
  gameActive: machine.mem8[GAME_ACTIVE],
  touchedRomBytes: reads.reduce((count, value) => count + Number(value !== 0), 0),
  ranges,
}, null, 2));
