// Inspect ROM-data dependencies without possessing or loading the original ROM.
// This is a feasibility probe, never a gameplay or compatibility test.
// Usage: node scripts/audit-arcade-js-invaders-feasibility.mjs PATH_TO_PINNED_ARCADE_JS [GENERATED_DIRECTORY] [MAX_FRAMES] [idle|coin-start|coin-start-move-fire]
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
  ANIM_DONE_FLAG, SCREEN_MODE_TOGGLE, loc_2015, GAME_IN_PROGRESS,
  ALIEN_COUNT, PLAYER_SHOT_STATUS, PLAYER_SHIP_X, ACTIVE_PLAYER_PAGE,
} = await moduleAt('games/invaders/idiomatic/names.js');
const manifest = (await moduleAt('games/invaders/manifest.js')).default;
const maxFrames = process.argv[4] === undefined ? 200 : Number(process.argv[4]);
if (!Number.isSafeInteger(maxFrames) || maxFrames < 1 || maxFrames > 5000)
  throw new Error('MAX_FRAMES must be an integer from 1 to 5000');
const scenario = process.argv[5] || 'idle';
if (!['idle', 'coin-start', 'coin-start-move-fire'].includes(scenario)) throw new Error('Unknown input scenario');

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
let firstPlayFrame = null;
let firstLiveFleetFrame = null;
let maxAlienCount = 0;
let splashResets = 0;
let lastTimer = null;
let minShipX = 255;
let maxShipX = 0;
let shotFrames = 0;
const actions = manifest.inputs.actions;
const result = runIdiomaticGame(machine, {
  nmiReturnPC: manifest.convergence.idiomatic.nmiReturnPC,
  maxFrames,
  onFrame: (m, frame) => {
    if (m.mem8[GAME_IN_PROGRESS] !== 0 && firstPlayFrame === null) firstPlayFrame = frame;
    const count = m.mem8[ALIEN_COUNT];
    if (count !== 0 && firstLiveFleetFrame === null) firstLiveFleetFrame = frame;
    maxAlienCount = Math.max(maxAlienCount, count);
    if (m.mem8[GAME_ACTIVE] && m.mem8[GAME_IN_PROGRESS]) {
      minShipX = Math.min(minShipX, m.mem8[PLAYER_SHIP_X]);
      maxShipX = Math.max(maxShipX, m.mem8[PLAYER_SHIP_X]);
      if (m.mem8[PLAYER_SHOT_STATUS]) shotFrames++;
    }
    const timer = m.mem8[FRAME_DELAY_TIMER];
    if (lastTimer !== null && timer === 0xb0 && lastTimer !== 0xb0) splashResets++;
    lastTimer = timer;
    if (scenario === 'idle') return;
    const input = {};
    const press = (action) => { input[action.port] = (input[action.port] || 0) | action.bit; };
    if (frame >= 300 && frame < 306) press(actions.coin);
    if (frame >= 360 && frame < 366) press(actions.start1);
    if (scenario === 'coin-start-move-fire') {
      if (frame >= 600 && frame < 660) press(actions.left);
      if (frame >= 700 && frame < 760) press(actions.right);
      if (frame >= 780 && frame < 786) press(actions.fire);
    }
    m.io.inputAssert = input;
  },
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
  scenario,
  firstPlayFrame,
  firstLiveFleetFrame,
  maxAlienCount,
  minShipX: minShipX === 255 ? null : minShipX,
  maxShipX,
  shotFrames,
  splashResets,
  frames: result.frames,
  stop: result.stop,
  stopError: result.stopError ? String(result.stopError) : null,
  attractDemoPtr: machine.mem8[ATTRACT_DEMO_PTR],
  gameActive: machine.mem8[GAME_ACTIVE],
  gameInProgress: machine.mem8[GAME_IN_PROGRESS],
  alienCount: machine.mem8[ALIEN_COUNT],
  shotStatus: machine.mem8[PLAYER_SHOT_STATUS],
  playerShipX: machine.mem8[PLAYER_SHIP_X],
  activePlayerPage: machine.mem8[ACTIVE_PLAYER_PAGE],
  player1FieldCells: Array.from({ length: 0x37 }, (_, i) => Number(machine.mem8[0x2100 + i] !== 0)).reduce((a, b) => a + b, 0),
  player1Round: machine.mem8[0x21fe],
  frameDelayTimer: machine.mem8[FRAME_DELAY_TIMER],
  taskFlags: machine.mem8[TASK_FLAGS],
  animDoneFlag: machine.mem8[ANIM_DONE_FLAG],
  screenModeToggle: machine.mem8[SCREEN_MODE_TOGGLE],
  armTrigger: machine.mem8[loc_2015],
  objectRecords: Array.from({ length: 6 }, (_, slot) => {
    const at = 0x2010 + slot * 16;
    return { at: `0x${at.toString(16)}`, head: Array.from({ length: 8 }, (_, i) => machine.mem8[at + i]) };
  }),
  nonzeroVideoBytes: machine.mem.ram.subarray(0x400).reduce(
    (count, value) => count + Number(value !== 0), 0),
  touchedRomBytes: reads.reduce((count, value) => count + Number(value !== 0), 0),
  ranges,
}, null, 2));
