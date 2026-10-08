// Inspect ROM-data dependencies without possessing or loading the original ROM.
// This is a feasibility probe, never a gameplay or compatibility test.
// Usage: node scripts/audit-arcade-js-invaders-feasibility.mjs PATH_TO_PINNED_ARCADE_JS [GENERATED_DIRECTORY] [MAX_FRAMES] [SCENARIO] [--trail-experiment] [--shot2-experiment] [--saucer-experiment] [--trace-low-rom]
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
const sourceDiff = execFileSync('git', ['diff', '--binary', '--', 'games/invaders/idiomatic/reverseFleetAtEdge.js'], { cwd: checkout });
const sourcePatchSha256 = sourceDiff.length ? createHash('sha256').update(sourceDiff).digest('hex') : null;
if (sourcePatchSha256 && sourcePatchSha256 !== 'e1242a57f67d90444be041d9a5f1ea5b6f994b0934bd828f9311e7e73153aad7')
  throw new Error(`Unexpected edge patch checksum ${sourcePatchSha256}`);
const trailExperiment = process.argv.includes('--trail-experiment');
const trailDiff = execFileSync('git', ['diff', '--binary', '--', 'games/invaders/idiomatic/drawPendingAlien.js'], { cwd: checkout });
const trailPatchSha256 = trailDiff.length ? createHash('sha256').update(trailDiff).digest('hex') : null;
if (trailExperiment && trailPatchSha256 !== 'e76a8d64ae69816b66f4abfa6ce73d77464267265e9488c000b049c4a2e52366')
  throw new Error(`Unexpected trail patch checksum ${trailPatchSha256}`);
if (!trailExperiment && trailPatchSha256) throw new Error('Unexpected trail patch without --trail-experiment');
const shot2Experiment = process.argv.includes('--shot2-experiment');
const shot2Diff = execFileSync('git', ['diff', '--binary', '--', 'games/invaders/idiomatic/alienShotSlot2Handler.js'], { cwd: checkout });
const shot2PatchSha256 = shot2Diff.length ? createHash('sha256').update(shot2Diff).digest('hex') : null;
if (shot2Experiment && shot2PatchSha256 !== 'c1a645c39d2482405b8d11bd6949beda576bcf03a6dda76e2f113bdea8cd6ca7')
  throw new Error(`Unexpected shot-2 patch checksum ${shot2PatchSha256}`);
if (!shot2Experiment && shot2PatchSha256) throw new Error('Unexpected shot-2 patch without --shot2-experiment');
const saucerExperiment = process.argv.includes('--saucer-experiment');
const saucerDiff = execFileSync('git', ['diff', '--binary', '--', 'games/invaders/idiomatic/saucerHandler.js'], { cwd: checkout });
const saucerPatchSha256 = saucerDiff.length ? createHash('sha256').update(saucerDiff).digest('hex') : null;
if (saucerExperiment && saucerPatchSha256 !== 'a9943e8cf729cdf52ce7458214b6fe9288c896778401adcf4472817b88cfb87f')
  throw new Error(`Unexpected saucer patch checksum ${saucerPatchSha256}`);
if (!saucerExperiment && saucerPatchSha256) throw new Error('Unexpected saucer patch without --saucer-experiment');
const excluded = ['.', ':(exclude)games/invaders/idiomatic/reverseFleetAtEdge.js'];
if (trailExperiment) excluded.push(':(exclude)games/invaders/idiomatic/drawPendingAlien.js');
if (shot2Experiment) excluded.push(':(exclude)games/invaders/idiomatic/alienShotSlot2Handler.js');
if (saucerExperiment) excluded.push(':(exclude)games/invaders/idiomatic/saucerHandler.js');
const otherTrackedChanges = execFileSync('git', ['diff', '--name-only', '--', ...excluded], { cwd: checkout, encoding: 'utf8' }).trim();
if (otherTrackedChanges) throw new Error(`Unexpected tracked changes in pinned source: ${otherTrackedChanges}`);
const moduleAt = (path) => import(pathToFileURL(join(checkout, path)).href);
const { Machine, resolveAllIdiomatic } = await moduleAt('games/invaders/machine.js');
const { runIdiomaticGame } = await moduleAt('core/frame-stepped.js');
const {
  ATTRACT_DEMO_PTR, GAME_ACTIVE, FRAME_DELAY_TIMER, TASK_FLAGS,
  ANIM_DONE_FLAG, SCREEN_MODE_TOGGLE, loc_2015, GAME_IN_PROGRESS,
  ALIEN_COUNT, PLAYER_SHOT_STATUS, PLAYER_SHIP_X, ACTIVE_PLAYER_PAGE,
  FLEET_MARCH_ENABLE, ALIEN_DRAW_INDEX, ALIEN_DRAW_ADDR,
  COLLISION_FLAG, PLAYER_SHOT_HIT, loc_2029, loc_202a,
  FLEET_MOVE_DIR, loc_2008,
} = await moduleAt('games/invaders/idiomatic/names.js');
const manifest = (await moduleAt('games/invaders/manifest.js')).default;
const maxFrames = process.argv[4] === undefined ? 200 : Number(process.argv[4]);
if (!Number.isSafeInteger(maxFrames) || maxFrames < 1 || maxFrames > 50000)
  throw new Error('MAX_FRAMES must be an integer from 1 to 50000');
const scenario = process.argv[5] || 'idle';
const traceLowRom = process.argv.includes('--trace-low-rom');
if (!['idle', 'coin-start', 'coin-start-move-fire', 'coin-start-repeat-fire', 'coin-start-sweep-fire', 'coin-start-sweep-fire-fast', 'coin-start-sweep-fire-fast-restart', 'coin-start-sweep-fire-fast-edge-clear', 'coin-start-sweep-fire-fast-edge-clear-restart'].includes(scenario)) throw new Error('Unknown input scenario');

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
if (process.argv.includes('--award-table-diagnostic')) {
  // Synthetic state fixture, not a played hit or release-gameplay claim.
  const { seedWorkRamImage } = await moduleAt('games/invaders/idiomatic/seedWorkRamImage.js');
  const { awardSaucerScore } = await moduleAt('games/invaders/idiomatic/awardSaucerScore.js');
  const { applyPendingScoreAdd } = await moduleAt('games/invaders/idiomatic/applyPendingScoreAdd.js');
  const { resolvePlayerShotHit } = await moduleAt('games/invaders/idiomatic/resolvePlayerShotHit.js');
  const { saucerHandler } = await moduleAt('games/invaders/idiomatic/saucerHandler.js');
  const awards = [];
  for (let index = 0; index < 4; index++) {
    seedWorkRamImage(machine);
    machine.mem8[0x2067] = 0x21;
    machine.mem16[0x208d] = 0x1854 + index;
    machine.mem16[0x20f8] = 0;
    machine.mem16[0x20fa] = 0x281c;
    for (let address = 0x2400; address < 0x4000; address++) machine.mem8[address] = 0;
    awardSaucerScore(machine);
    const delta = machine.mem16[0x20f2];
    const glyphPointer = machine.mem16[0x2087];
    const renderedBytes = Array.from({ length: 0x1c00 }, (_, i) => machine.mem8[0x2400 + i]).filter(Boolean).length;
    applyPendingScoreAdd(machine);
    const score = machine.mem16[0x20f8];
    if (delta !== (index + 1) * 0x100 || score !== delta ||
        glyphPointer !== 0x1d54 + index * 3 || renderedBytes === 0 || machine.mem8[0x20f1])
      throw Error(`Saucer award fixture failed for key ${index}`);
    awards.push({ index, delta, score, glyphPointer, renderedBytes });
  }
  seedWorkRamImage(machine);
  machine.mem8[0x2080] = 2;
  machine.mem8[0x2082] = 55;
  machine.mem8[0x2083] = 1;
  machine.mem8[0x2084] = 1;
  machine.mem8[0x2025] = 2;
  machine.mem8[0x2029] = 0xd0;
  machine.mem8[0x2002] = 1;
  machine.mem16[0x208d] = 0x1854;
  machine.mem8[0x20f1] = 0;
  const initialCountdown = machine.mem8[0x2086];
  resolvePlayerShotHit(machine);
  if (machine.mem8[0x2085] !== 1 || machine.mem8[0x2025] !== 4 || machine.mem8[0x2002])
    throw Error('Synthetic saucer collision did not retire the player shot');
  let awardTick = null, retireTick = null;
  for (let tick = 1; tick <= 256; tick++) {
    machine.mem8[0x2072] = machine.mem8[0x208a] & 0x80;
    saucerHandler(machine);
    if (machine.mem8[0x20f1] && awardTick === null) awardTick = tick;
    if (!machine.mem8[0x2084]) { retireTick = tick; break; }
  }
  if (awardTick === null || retireTick === null || machine.mem16[0x20f2] !== 0x100)
    throw Error('Synthetic saucer lifecycle did not award and retire');
  console.log(JSON.stringify({ diagnostic: 'synthetic-award-and-lifecycle', inputData, awards,
    syntheticLifecycle: { initialCountdown, awardTick, retireTick },
    naturalHitVerified: false, browserGameplayVerified: false }));
  process.exit(0);
}
const shipHandlerWrites = [];
let currentFrame = 0;
const rawWrite8 = machine.mem.write8.bind(machine.mem);
machine.mem.write8 = (address, value, ...rest) => {
  if (currentFrame > 0 && (address === 0x2013 || address === 0x2014) && shipHandlerWrites.length < 8 && machine.mem8[address] !== (value & 255))
    shipHandlerWrites.push({ frame: currentFrame, address, value: value & 255, alienDrawCoord: machine.mem16[ALIEN_DRAW_ADDR], fleetRef: machine.mem16[0x2009], alienIndex: machine.mem8[ALIEN_DRAW_INDEX] });
  return rawWrite8(address, value, ...rest);
};
const reads = new Uint32Array(8192);
const lowRomReadSamples = [];
const lowRomReadKeys = new Set();
const read8 = machine.mem.read8.bind(machine.mem);
machine.mem.read8 = (address) => {
  const masked = address & 0x7fff;
  if (masked < reads.length) reads[masked]++;
  if (traceLowRom && masked < 0x100 && lowRomReadSamples.length < 24) {
    const stack = new Error().stack.split('\n').slice(2, 6);
    const key = `${masked}:${stack[0]}`;
    if (!lowRomReadKeys.has(key)) { lowRomReadKeys.add(key); lowRomReadSamples.push({ frame: currentFrame, address: masked, stack }); }
  }
  return read8(address);
};
let firstPlayFrame = null;
let firstLiveFleetFrame = null;
let firstAlienHitFrame = null;
let maxAlienCount = 0;
let minAlienCountAfterStart = 55;
let firstRoundAdvanceFrame = null;
let firstGameOverFrame = null;
let secondPlayFrame = null;
let splashResets = 0;
let lastTimer = null;
let minShipX = 255;
let maxShipX = 0;
let shotFrames = 0;
let marchingFrames = 0;
let maxDrawIndex = 0;
let collisionFrames = 0;
let saucerArmedFrames = 0;
let firstSaucerArmedFrame = null;
let saucerActiveFrames = 0;
let firstSaucerActiveFrame = null;
let shotHitFrames = 0;
let minShotY = 255;
let maxShotY = 0;
let alienShot2LiveFrames = 0;
let alienShot2BlowupFrames = 0;
let minAlienShotY = 255;
let maxAlienShotY = 0;
let alienShot2LowFrames = 0;
let alienShot2NearShipFrames = 0;
let alienShot2LowCollisionFrames = 0;
const alienShot2LowCollisionY = new Uint32Array(41);
const alienShot2LowSamples = [];
let maxPlayer1ScoreRaw = 0;
const shieldSamples = [];
const shipCountSamples = [];
const shipTransitions = [];
let lastShipAnim = null;
let lastShipCount = null;
const shotSamples = [];
const fleetSamples = [];
let firstBothEdgesFrame = null;
let sweepRight = true;
let pressNextReadyFrame = false;
let lastFleetDir = null;
let edgeClears = 0;
const actions = manifest.inputs.actions;
const result = runIdiomaticGame(machine, {
  nmiReturnPC: manifest.convergence.idiomatic.nmiReturnPC,
  maxFrames,
  onFrame: (m, frame) => {
    currentFrame = frame;
    if (m.mem8[0x2083]) {
      saucerArmedFrames++;
      firstSaucerArmedFrame ??= frame;
    }
    if (m.mem8[0x2084]) {
      saucerActiveFrames++;
      firstSaucerActiveFrame ??= frame;
    }
    if (m.mem8[0x2035] & 0x80) {
      alienShot2LiveFrames++;
      minAlienShotY = Math.min(minAlienShotY, m.mem8[0x203d]);
      maxAlienShotY = Math.max(maxAlienShotY, m.mem8[0x203d]);
      if (m.mem8[0x203d] <= 40) {
        alienShot2LowFrames++;
        if (Math.abs(m.mem8[0x203e] - m.mem8[PLAYER_SHIP_X]) <= 8) alienShot2NearShipFrames++;
        if (m.mem8[COLLISION_FLAG]) {
          alienShot2LowCollisionFrames++;
          alienShot2LowCollisionY[m.mem8[0x203d]]++;
        }
        if (alienShot2LowSamples.length < 24 && (alienShot2LowSamples.length === 0 || frame - alienShot2LowSamples.at(-1).frame >= 30))
          alienShot2LowSamples.push({ frame, x: m.mem8[0x203e], y: m.mem8[0x203d], shipX: m.mem8[PLAYER_SHIP_X], status: m.mem8[0x2035], shipAnim: m.mem8[0x2015], collision: m.mem8[COLLISION_FLAG] });
      }
    }
    if (m.mem8[0x2035] & 0x01) alienShot2BlowupFrames++;
    const shipAnim = m.mem8[0x2015];
    const shipCount = m.mem8[0x21ff];
    if ((shipAnim !== lastShipAnim || shipCount !== lastShipCount) && shipTransitions.length < 60)
      shipTransitions.push({ frame, anim: shipAnim, count: shipCount, play: m.mem8[GAME_IN_PROGRESS], shotX: m.mem8[0x203e], shotY: m.mem8[0x203d] });
    lastShipAnim = shipAnim;
    lastShipCount = shipCount;
    maxPlayer1ScoreRaw = Math.max(maxPlayer1ScoreRaw, m.mem16[0x20f8]);
    if ([537, 1000, 2000, 3000, 5000, 10000].includes(frame)) {
      let shieldBits = 0;
      for (let shield = 0; shield < 4; shield++) for (let row = 0; row < 22; row++) for (let col = 0; col < 2; col++) {
        let byte = m.mem8[0x2806 + shield * 0x2e0 + row * 0x20 + col];
        while (byte) { shieldBits += byte & 1; byte >>= 1; }
      }
      shieldSamples.push({ frame, bits: shieldBits });
      shipCountSamples.push({ frame, count: m.mem8[0x21ff], anim: m.mem8[0x2015], ready: m.mem8[0x2069], coordY: m.mem8[0x201a], coordX: m.mem8[0x201b] });
    }
    if (m.mem8[GAME_IN_PROGRESS] !== 0 && firstPlayFrame === null) firstPlayFrame = frame;
    const count = m.mem8[ALIEN_COUNT];
    if (count !== 0 && firstLiveFleetFrame === null) firstLiveFleetFrame = frame;
    if (firstLiveFleetFrame !== null && count > 0 && count < 55 && firstAlienHitFrame === null) firstAlienHitFrame = frame;
    maxAlienCount = Math.max(maxAlienCount, count);
    if (firstLiveFleetFrame !== null) minAlienCountAfterStart = Math.min(minAlienCountAfterStart, count);
    if (firstLiveFleetFrame !== null && m.mem8[0x21fe] > 0 && firstRoundAdvanceFrame === null) firstRoundAdvanceFrame = frame;
    if (firstPlayFrame !== null && m.mem8[GAME_IN_PROGRESS] === 0 && firstGameOverFrame === null) firstGameOverFrame = frame;
    if (firstGameOverFrame !== null && m.mem8[GAME_IN_PROGRESS] !== 0 && secondPlayFrame === null) secondPlayFrame = frame;
    if (m.mem8[GAME_ACTIVE] && m.mem8[GAME_IN_PROGRESS]) {
      minShipX = Math.min(minShipX, m.mem8[PLAYER_SHIP_X]);
      maxShipX = Math.max(maxShipX, m.mem8[PLAYER_SHIP_X]);
      if (m.mem8[PLAYER_SHOT_STATUS]) shotFrames++;
      if (m.mem8[FLEET_MARCH_ENABLE]) marchingFrames++;
      maxDrawIndex = Math.max(maxDrawIndex, m.mem8[ALIEN_DRAW_INDEX]);
      if (m.mem8[COLLISION_FLAG]) collisionFrames++;
      if (m.mem8[PLAYER_SHOT_HIT]) shotHitFrames++;
      if (m.mem8[PLAYER_SHOT_STATUS] === 2) {
        minShotY = Math.min(minShotY, m.mem8[loc_2029]);
        maxShotY = Math.max(maxShotY, m.mem8[loc_2029]);
      }
      if (scenario === 'coin-start-move-fire' && ((frame >= 810 && frame <= 840 && frame % 5 === 0) || [860, 900, 1000].includes(frame)))
        shotSamples.push({ frame, state: m.mem8[PLAYER_SHOT_STATUS], y: m.mem8[loc_2029], x: m.mem8[loc_202a], collision: m.mem8[COLLISION_FLAG], hit: m.mem8[PLAYER_SHOT_HIT] });
      if (scenario === 'coin-start-sweep-fire-fast') {
        const right = m.mem.ram.subarray(0x1ea4, 0x1ebb);
        const left = m.mem.ram.subarray(0x0524, 0x053b);
        const rightEdgeLit = right.some(Boolean);
        const leftEdgeLit = left.some(Boolean);
        if (rightEdgeLit && leftEdgeLit && firstBothEdgesFrame === null) firstBothEdgesFrame = frame;
        if ([537, 1000, 1820, 1821, 1822, 1825, 3000, 5000, 6385, 6400].includes(frame))
          fleetSamples.push({ frame, count, ref: m.mem16[0x2009], dir: m.mem8[FLEET_MOVE_DIR], step: m.mem8[loc_2008], index: m.mem8[ALIEN_DRAW_INDEX], rightEdgeLit, leftEdgeLit, rightPixels: Array.from(right, (v,i) => v ? i : null).filter(v => v !== null), leftPixels: Array.from(left, (v,i) => v ? i : null).filter(v => v !== null) });
      }
      if (scenario === 'coin-start-sweep-fire-fast-edge-clear' || scenario === 'coin-start-sweep-fire-fast-edge-clear-restart') {
        const dir = m.mem8[FLEET_MOVE_DIR];
        if (lastFleetDir !== null && dir !== lastFleetDir) {
          const leftBehind = dir ? 0x3ea4 : 0x2524;
          for (let i = 0; i < 0x17; i++) m.mem8[leftBehind + i] = 0;
          edgeClears++;
        }
        lastFleetDir = dir;
      }
    }
    const timer = m.mem8[FRAME_DELAY_TIMER];
    if (lastTimer !== null && timer === 0xb0 && lastTimer !== 0xb0) splashResets++;
    lastTimer = timer;
    if (scenario === 'idle') return;
    const input = {};
    const press = (action) => { input[action.port] = (input[action.port] || 0) | action.bit; };
    if (frame >= 300 && frame < 306) press(actions.coin);
    if (frame >= 360 && frame < 366) press(actions.start1);
    if ((scenario === 'coin-start-sweep-fire-fast-restart' || scenario === 'coin-start-sweep-fire-fast-edge-clear-restart') && firstGameOverFrame !== null) {
      if (frame >= firstGameOverFrame + 245 && frame < firstGameOverFrame + 251) press(actions.coin);
      if (frame >= firstGameOverFrame + 305 && frame < firstGameOverFrame + 311) press(actions.start1);
    }
    if (scenario === 'coin-start-move-fire' || scenario === 'coin-start-repeat-fire') {
      if (frame >= 600 && frame < 660) press(actions.left);
      if (frame >= 700 && frame < 790) press(actions.right);
      if (frame >= 810 && frame < 816) press(actions.fire);
      if (scenario === 'coin-start-repeat-fire' && frame >= 900 && (frame - 900) % 45 < 4) press(actions.fire);
    }
    if ((scenario === 'coin-start-sweep-fire' || scenario === 'coin-start-sweep-fire-fast' || scenario === 'coin-start-sweep-fire-fast-restart' || scenario === 'coin-start-sweep-fire-fast-edge-clear' || scenario === 'coin-start-sweep-fire-fast-edge-clear-restart') && frame >= 600) {
      if (m.mem8[PLAYER_SHIP_X] >= 210) sweepRight = false;
      if (m.mem8[PLAYER_SHIP_X] <= 48) sweepRight = true;
      press(sweepRight ? actions.right : actions.left);
      if (scenario === 'coin-start-sweep-fire' && (frame - 610) % 40 < 4) press(actions.fire);
      if (scenario === 'coin-start-sweep-fire-fast' || scenario === 'coin-start-sweep-fire-fast-restart' || scenario === 'coin-start-sweep-fire-fast-edge-clear' || scenario === 'coin-start-sweep-fire-fast-edge-clear-restart') {
        if (m.mem8[PLAYER_SHOT_STATUS] === 0) {
          if (pressNextReadyFrame) press(actions.fire);
          pressNextReadyFrame = !pressNextReadyFrame;
        } else pressNextReadyFrame = false;
      }
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
  sourcePatchSha256,
  trailPatchSha256,
  shot2PatchSha256,
  saucerPatchSha256,
  trailPositions: trailExperiment ? Array.from(machine._openSwarmAlienPositions || [], ([key, packed]) => ({ key, packed, base: 0x2000 | ((packed >> 3) & 0x1fff) })) : undefined,
  headerGlyphPixels: Array.from({ length: 28 }, (_, glyph) => Array.from({ length: 8 }, (_, row) => machine.mem8[0x241e + glyph * 0x100 + row * 0x20]).reduce((sum, byte) => sum + Number(byte !== 0), 0)),
  inputData,
  shipHandlerWrites,
  scenario,
  firstPlayFrame,
  firstLiveFleetFrame,
  firstAlienHitFrame,
  maxAlienCount,
  minAlienCountAfterStart,
  firstRoundAdvanceFrame,
  firstGameOverFrame,
  secondPlayFrame,
  minShipX: minShipX === 255 ? null : minShipX,
  maxShipX,
  shotFrames,
  alienShot2LiveFrames,
  alienShot2BlowupFrames,
  alienShot2LowFrames,
  alienShot2NearShipFrames,
  alienShot2LowCollisionFrames,
  alienShot2LowCollisionY: Array.from(alienShot2LowCollisionY, (count, y) => count ? { y, count } : null).filter(Boolean),
  alienShot2LowSamples,
  alienShot2Status: machine.mem8[0x2035],
  alienShotStep: machine.mem8[0x207e],
  alienShotBlowupTimer: machine.mem8[0x2078],
  alienShot2Y: machine.mem8[0x203d],
  minAlienShotY: minAlienShotY === 255 ? null : minAlienShotY,
  maxAlienShotY,
  maxPlayer1ScoreRaw,
  shieldSamples,
  shipCountSamples,
  shipTransitions,
  alienShot2Gate: machine.mem16[0x2038],
  shipReadyFlag: machine.mem8[0x2069],
  alienShotRate: machine.mem8[0x20cf],
  alienShotRateGates: [machine.mem8[0x2070], machine.mem8[0x2071]],
  marchingFrames,
  maxDrawIndex,
  collisionFrames,
  saucerArmedFrames,
  firstSaucerArmedFrame,
  saucerActiveFrames,
  firstSaucerActiveFrame,
  shotHitFrames,
  minShotY: minShotY === 255 ? null : minShotY,
  maxShotY,
  shotSamples,
  fleetSamples,
  firstBothEdgesFrame,
  edgeClears,
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
  shotY: machine.mem8[loc_2029],
  shotX: machine.mem8[loc_202a],
  alienDrawAddr: machine.mem16[ALIEN_DRAW_ADDR],
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
  ...(traceLowRom ? { lowRomReadSamples } : {}),
}, null, 2));
if (result.stopError) process.exitCode = 1;
