// Inspect ROM-data dependencies without possessing or loading the original ROM.
// This is a feasibility probe, never a gameplay or compatibility test.
// Usage: node scripts/audit-arcade-js-invaders-feasibility.mjs PATH_TO_PINNED_ARCADE_JS [GENERATED_DIRECTORY] [MAX_FRAMES]
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const checkout = resolve(process.argv[2] || '');
if (!process.argv[2]) throw new Error('Pass the pinned arcade-js checkout path');
const expected = 'e849d086f4168c9a0e1ab501d62efbe3766def8a';
const actual = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: checkout, encoding: 'utf8' }).trim();
if (actual !== expected) throw new Error(`Expected arcade-js ${expected}, got ${actual}`);
const moduleAt = (path) => import(pathToFileURL(join(checkout, path)).href);
const { Machine, resolveAllIdiomatic } = await moduleAt('games/invaders/machine.js');
const { runIdiomaticGame } = await moduleAt('core/frame-stepped.js');
const {
  ATTRACT_DEMO_PTR, GAME_ACTIVE, FRAME_DELAY_TIMER, TASK_FLAGS,
  ANIM_DONE_FLAG, SCREEN_MODE_TOGGLE, loc_2015,
} = await moduleAt('games/invaders/idiomatic/names.js');
const manifest = (await moduleAt('games/invaders/manifest.js')).default;
const maxFrames = process.argv[4] === undefined ? 200 : Number(process.argv[4]);
if (!Number.isSafeInteger(maxFrames) || maxFrames < 1 || maxFrames > 5000)
  throw new Error('MAX_FRAMES must be an integer from 1 to 5000');

let rom = new Uint8Array(8192);
let inputData = '8,192 zero bytes; no original ROM';
if (process.argv[3]) {
  const generated = resolve(process.argv[3]);
  const manifest = JSON.parse(readFileSync(join(generated, 'manifest.json'), 'utf8'));
  if (manifest.originalAssetsRead !== false || manifest.status !== 'incomplete-data-format-probe')
    throw new Error('Only the declared independent draft data is accepted by this probe');
  const bytes = readFileSync(join(generated, manifest.file.name));
  const digest = createHash('sha256').update(bytes).digest('hex');
  if (bytes.length !== 8192 || digest !== manifest.file.sha256)
    throw new Error('Generated draft size or checksum does not match its manifest');
  rom = new Uint8Array(bytes);
  inputData = `independent incomplete draft ${digest}`;
}
const machine = await Machine.create(rom, {
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
  maxFrames,
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
  inputData,
  frames: result.frames,
  stop: result.stop,
  stopError: result.stopError ? String(result.stopError) : null,
  attractDemoPtr: machine.mem8[ATTRACT_DEMO_PTR],
  gameActive: machine.mem8[GAME_ACTIVE],
  frameDelayTimer: machine.mem8[FRAME_DELAY_TIMER],
  taskFlags: machine.mem8[TASK_FLAGS],
  animDoneFlag: machine.mem8[ANIM_DONE_FLAG],
  screenModeToggle: machine.mem8[SCREEN_MODE_TOGGLE],
  armTrigger: machine.mem8[loc_2015],
  nonzeroVideoBytes: machine.mem.ram.subarray(0x400).reduce(
    (count, value) => count + Number(value !== 0), 0),
  touchedRomBytes: reads.reduce((count, value) => count + Number(value !== 0), 0),
  ranges,
}, null, 2));
