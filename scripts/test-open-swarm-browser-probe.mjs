// Private silent browser integration check; this is not a release gameplay gate.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, join, extname, sep } from 'node:path';
import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const checkout = resolve(process.argv[2] || '.cache/arcade-js');
const dataFile = resolve(process.argv[3] || '.cache/open-swarm-draft/open-swarm-draft.bin');
const headerReview = process.argv.includes('--header-review');
const edgeReview = process.argv.includes('--edge-review') || headerReview;
const trailExperiment = process.argv.includes('--trail-experiment');
const acceleratedLoop = process.argv.includes('--accelerated-loop');
const realtimeLoop = process.argv.includes('--realtime-loop');
const shieldReview = process.argv.includes('--shield-review');
const damageReview = process.argv.includes('--damage-review');
const panelReview = process.argv.includes('--panel-review');
const lateReview = process.argv.includes('--late-review');
if (lateReview && !realtimeLoop) throw Error('--late-review requires --realtime-loop');
if ([acceleratedLoop, realtimeLoop, shieldReview, damageReview].filter(Boolean).length > 1) throw Error('Choose only one diagnostic mode');
const shot2Experiment = process.argv.includes('--shot2-experiment');
const saucerExperiment = process.argv.includes('--saucer-experiment');
const baselineDataSha256 = '5b86e0380723c6ed5cb53e2720d30fe275303255f89fa85b56f861913fcc32ae';
const shot2DataSha256 = 'c6acaea76d0122d90dc4bafa46159d69e4fc01a9a8095ca8d92301925da4ff97';
const saucerDataSha256 = '2432f565ad1fa5773b6b3cfa78ef8b6fd8dbec6bf37d2e170be57efc578c09c0';
const dataSha256 = createHash('sha256').update(await readFile(dataFile)).digest('hex');
if (dataSha256 !== baselineDataSha256 && !(shot2Experiment && !saucerExperiment && dataSha256 === shot2DataSha256) &&
    !(shot2Experiment && saucerExperiment && dataSha256 === saucerDataSha256))
  throw Error(`Unexpected independent data image ${dataSha256}`);
const probeFile = resolve('experiments/open-swarm-browser-probe.html');
const revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: checkout, encoding: 'utf8' }).trim();
if (revision !== 'e849d086f4168c9a0e1ab501d62efbe3766def8a') throw Error(`Unexpected arcade-js revision ${revision}`);
const patch = execFileSync('git', ['diff', '--binary', '--', 'games/invaders/idiomatic/reverseFleetAtEdge.js'], { cwd: checkout });
const patchSha256 = createHash('sha256').update(patch).digest('hex');
if (patchSha256 !== 'e1242a57f67d90444be041d9a5f1ea5b6f994b0934bd828f9311e7e73153aad7') throw Error(`Unexpected edge patch ${patchSha256}`);
if (trailExperiment) {
  const trailDiff = execFileSync('git', ['diff', '--binary', '--', 'games/invaders/idiomatic/drawPendingAlien.js'], { cwd: checkout });
  const trailSha256 = createHash('sha256').update(trailDiff).digest('hex');
  if (trailSha256 !== 'e76a8d64ae69816b66f4abfa6ce73d77464267265e9488c000b049c4a2e52366') throw Error(`Unexpected trail experiment patch ${trailSha256}`);
}
if (shot2Experiment) {
  const shotDiff = execFileSync('git', ['diff', '--binary', '--', 'games/invaders/idiomatic/alienShotSlot2Handler.js'], { cwd: checkout });
  const shotSha256 = createHash('sha256').update(shotDiff).digest('hex');
  if (shotSha256 !== 'c1a645c39d2482405b8d11bd6949beda576bcf03a6dda76e2f113bdea8cd6ca7') throw Error(`Unexpected shot-2 experiment patch ${shotSha256}`);
}
if (saucerExperiment) {
  const saucerDiff = execFileSync('git', ['diff', '--binary', '--', 'games/invaders/idiomatic/saucerHandler.js'], { cwd: checkout });
  const saucerSha256 = createHash('sha256').update(saucerDiff).digest('hex');
  if (saucerSha256 !== 'a9943e8cf729cdf52ce7458214b6fe9288c896778401adcf4472817b88cfb87f') throw Error(`Unexpected saucer experiment patch ${saucerSha256}`);
}
const excluded = ['.', ':(exclude)games/invaders/idiomatic/reverseFleetAtEdge.js'];
if (trailExperiment) excluded.push(':(exclude)games/invaders/idiomatic/drawPendingAlien.js');
if (shot2Experiment) excluded.push(':(exclude)games/invaders/idiomatic/alienShotSlot2Handler.js');
if (saucerExperiment) excluded.push(':(exclude)games/invaders/idiomatic/saucerHandler.js');
const otherChanges = execFileSync('git', ['diff', '--name-only', '--', ...excluded], { cwd: checkout, encoding: 'utf8' }).trim();
if (otherChanges) throw Error(`Unexpected tracked changes in upstream checkout: ${otherChanges}`);
const types = { '.js': 'text/javascript', '.html': 'text/html; charset=utf-8', '.bin': 'application/octet-stream' };
const server = createServer(async (request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  let file;
  if (pathname === '/web/open-swarm-probe.html') file = probeFile;
  else if (pathname === '/web/open-swarm-data.bin') file = dataFile;
  else {
    file = resolve(join(checkout, decodeURIComponent(pathname.slice(1))));
    if (!file.startsWith(checkout + sep)) { response.writeHead(403).end(); return; }
  }
  try {
    let bytes = await readFile(file);
    if (pathname === '/web/open-swarm-probe.html' && dataSha256 !== baselineDataSha256) {
      const html = bytes.toString('utf8');
      if (!html.includes(baselineDataSha256)) throw Error('Private probe checksum anchor changed');
      bytes = Buffer.from(html.replace(baselineDataSha256, dataSha256));
    }
    if (pathname === '/web/worker.js') {
      // Private observation only: emit a small state sample without changing
      // game execution, input, renderer, or the upstream checkout on disk.
      let source = bytes.toString('utf8').replaceAll('\r\n', '\n');
      const anchor = 'function serviceIdiomaticFrame(machine, frameIndex) {\n  readInputsInto(machine);';
      if (!source.includes(anchor)) throw Error('Upstream worker telemetry anchor changed');
      if (acceleratedLoop) {
        // Test-only control and timing. This does not establish real-time human play.
        const pace = 'machine._next += 1000 / 60;';
        if (!source.includes(pace)) throw Error('Upstream pacing anchor changed');
        source = source.replace(pace, 'machine._next += 1000 / 1200;');
        source = source.replace(anchor, `${anchor}\n  const auto = machine._openSwarmAuto ||= { right: true, fireNext: false, firstOver: null };\n  if (frameIndex > 600) {\n    if (machine.mem8[0x201b] >= 210) auto.right = false;\n    if (machine.mem8[0x201b] <= 48) auto.right = true;\n  }\n  if (frameIndex > 600 && machine.mem8[0x2025] === 0) auto.fireNext = !auto.fireNext;\n  else auto.fireNext = false;\n  if (frameIndex > 600 && machine.mem8[0x20ef] === 0 && auto.firstOver === null && auto.seenPlay) auto.firstOver = frameIndex;\n  if (machine.mem8[0x20ef]) auto.seenPlay = true;\n  let virtualInput = 0;\n  if (frameIndex >= 300 && frameIndex < 306) virtualInput |= 1;\n  if (frameIndex >= 360 && frameIndex < 366) virtualInput |= 4;\n  if (auto.firstOver !== null) {\n    if (frameIndex >= auto.firstOver + 245 && frameIndex < auto.firstOver + 251) virtualInput |= 1;\n    if (frameIndex >= auto.firstOver + 305 && frameIndex < auto.firstOver + 311) virtualInput |= 4;\n  }\n  if (frameIndex > 600) virtualInput |= auto.right ? 64 : 32;\n  if (frameIndex > 600 && auto.fireNext) virtualInput |= 16;\n  machine.io.inputAssert[PORTS.in1] = virtualInput;`);
      }
      source = source.replace(anchor, `${anchor}\n  const encounter = machine._openSwarmEncounter ||= { armed: 0, active: 0, hit: 0, wrongMode: 0, blocked: 0, tooFew: 0 };\n  if (machine.mem8[0x2083]) { encounter.armed++; if (machine.mem8[0x2080] !== 2) encounter.wrongMode++; if (machine.mem8[0x2056]) encounter.blocked++; if (machine.mem8[0x2082] < 8) encounter.tooFew++; }\n  if (machine.mem8[0x2084]) encounter.active++;\n  if (machine.mem8[0x2085]) encounter.hit++;\n  if (frameIndex % 15 === 0 || (Atomics.load(ctrl, 1) & 5)) { const header = Array.from({ length: 28 }, (_, glyph) => Array.from({ length: 8 }, (_, row) => machine.mem8[0x241e + glyph * 0x100 + row * 0x20])); let shieldBits = 0; for (let shield = 0; shield < 4; shield++) for (let row = 0; row < 22; row++) for (let col = 0; col < 2; col++) { let byte = machine.mem8[0x2806 + shield * 0x2e0 + row * 0x20 + col]; while (byte) { shieldBits += byte & 1; byte >>= 1; } } postMessage({ type: 'probe', frame: frameIndex, in1: Atomics.load(ctrl, 1), play: machine.mem8[0x20ef], shipX: machine.mem8[0x201b], ships: machine.mem8[0x21ff], shipAnim: machine.mem8[0x2015], shot: machine.mem8[0x2025], alienShot2: machine.mem8[0x2035], alienShot2Y: machine.mem8[0x203d], saucerActive: machine.mem8[0x2084], encounter: { ...encounter }, aliens: machine.mem8[0x2082], round: machine.mem8[0x21fe], score: machine.mem16[0x20f8], shieldBits, fleetDir: machine.mem8[0x200d], headerCells: header.filter(bytes => bytes.some(Boolean)).length, headerBits: header.flat().reduce((sum, byte) => { while (byte) { sum += byte & 1; byte >>= 1; } return sum; }, 0) }); }`);
      bytes = Buffer.from(source);
    }
    response.writeHead(200, {
      'content-type': types[extname(file)] || 'application/octet-stream',
      'cross-origin-opener-policy': 'same-origin',
      'cross-origin-embedder-policy': 'require-corp',
      'cross-origin-resource-policy': 'same-origin',
      'cache-control': 'no-store',
    });
    response.end(bytes);
  } catch { response.writeHead(404).end(); }
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
let browser;
try {
  browser = await chromium.launch({ headless: true, channel: 'msedge', args: ['--mute-audio'] });
  const page = await browser.newPage();
  await page.route('**/*', route => {
    if (route.request().url().startsWith(`http://127.0.0.1:${server.address().port}/`)) return route.continue();
    return route.abort();
  });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/web/open-swarm-probe.html`);
  await page.waitForFunction(() => window.__openSwarm.ready || window.__openSwarm.error, null, { timeout: 120_000 });
  const initial = await page.evaluate(() => window.__openSwarm);
  if (initial.error) throw Error(initial.error);
  const waitFrame = n => page.waitForFunction(min => window.__openSwarm.frames >= min || window.__openSwarm.error, n, { timeout: realtimeLoop ? 500_000 : damageReview ? 240_000 : shieldReview ? 120_000 : acceleratedLoop ? 180_000 : 30_000 });
  if (acceleratedLoop) {
    await waitFrame(14_000);
    await page.locator('canvas').screenshot({ path: '.cache/open-swarm-round-review.png' });
    await waitFrame(40_000);
    await page.locator('canvas').screenshot({ path: '.cache/open-swarm-accelerated-final.png' });
  } else if (realtimeLoop) {
    await page.evaluate(() => {
      const state = window.__openSwarm;
      let right = true, seenPlay = false, firstOver = null;
      const held = { coin: false, start: false, left: false, right: false, fire: false };
      function tick() {
        const frame = state.frames;
        const sample = state.probes.at(-1);
        if (sample?.play) seenPlay = true;
        if (seenPlay && !sample?.play && firstOver === null) firstOver = frame;
        if (sample?.shipX >= 210) right = false;
        if (sample?.shipX <= 48) right = true;
        const desired = {
          coin: (frame >= 300 && frame < 310) || (firstOver !== null && frame >= firstOver + 245 && frame < firstOver + 255),
          start: (frame >= 360 && frame < 370) || (firstOver !== null && frame >= firstOver + 305 && frame < firstOver + 315),
          left: frame >= 600 && !right,
          right: frame >= 600 && right,
          fire: frame >= 600 && frame % 12 < 5,
        };
        for (const [action, down] of Object.entries(desired)) {
          if (held[action] !== down) { state.setInput(action, down); held[action] = down; }
        }
        if (!state.error && frame < 23_000) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    });
    if (saucerExperiment) {
      await page.waitForFunction(() => window.__openSwarm.probes.at(-1)?.saucerActive || window.__openSwarm.error, null, { timeout: 400_000 });
      await page.locator('canvas').screenshot({ path: '.cache/open-swarm-saucer-realtime.png' });
    }
    if (lateReview) {
      await waitFrame(9000);
      await page.locator('canvas').screenshot({ path: '.cache/open-swarm-frame9000.png' });
      for (let frame = 10000; frame <= 15000; frame += 100) {
        await waitFrame(frame);
        await page.locator('canvas').screenshot({ path: `.cache/open-swarm-frame${frame}.png` });
      }
    }
    await waitFrame(23_000);
  } else if (shieldReview || damageReview) {
    await waitFrame(300);
    await page.keyboard.down('Digit5');
    await page.waitForTimeout(130);
    await page.keyboard.up('Digit5');
    await waitFrame(360);
    await page.keyboard.down('Digit1');
    await page.waitForTimeout(130);
    await page.keyboard.up('Digit1');
    await waitFrame(damageReview ? 9000 : 5000);
  } else {
    if (panelReview) {
      await waitFrame(240);
      await page.locator('canvas').screenshot({ path: '.cache/open-swarm-panel240.png' });
    }
    await waitFrame(300);
    await page.keyboard.down('Digit5');
    await page.waitForTimeout(130);
    await page.keyboard.up('Digit5');
    await waitFrame(360);
    await page.keyboard.down('Digit1');
    await page.waitForTimeout(130);
    await page.keyboard.up('Digit1');
    await waitFrame(600);
    await page.keyboard.down('ArrowRight');
    await waitFrame(640);
    await page.keyboard.down('Space');
    await waitFrame(670);
    await page.keyboard.up('ArrowRight');
    await page.keyboard.up('Space');
    if (panelReview) await page.locator('canvas').screenshot({ path: '.cache/open-swarm-panel670.png' });
    if (edgeReview) {
      await page.locator('canvas').screenshot({ path: '.cache/open-swarm-frame670.png' });
      await page.waitForFunction(() => window.__openSwarm.frames >= 1840 || window.__openSwarm.error, null, { timeout: 60_000 });
      await page.locator('canvas').screenshot({ path: '.cache/open-swarm-frame1840.png' });
      if (headerReview) {
        await page.waitForFunction(() => window.__openSwarm.frames >= 2200 || window.__openSwarm.error, null, { timeout: 30_000 });
        await page.locator('canvas').screenshot({ path: '.cache/open-swarm-frame2200.png' });
      }
    }
  }
  const result = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    let nonblack = 0;
    for (let i = 0; i < pixels.length; i += 4) if (pixels[i] || pixels[i + 1] || pixels[i + 2]) nonblack++;
    return { ...window.__openSwarm, nonblack, canvas: [canvas.width, canvas.height] };
  });
  const probes = result.probes;
  const inputProof = {
    coin: probes.some(p => p.in1 & 1),
    start: probes.some(p => p.in1 & 4),
    right: probes.some(p => p.in1 & 64),
    fire: probes.some(p => p.in1 & 16),
    play: probes.some(p => p.play),
    moved: Math.max(...probes.filter(p => p.frame >= 600).map(p => p.shipX)) > Math.min(...probes.filter(p => p.frame >= 600).map(p => p.shipX)),
    shot: probes.some(p => p.shot),
    alienCount: Math.max(...probes.map(p => p.aliens)),
    alienShot2LiveSamples: probes.filter(p => p.alienShot2 & 0x80).length,
    saucerActiveSamples: probes.filter(p => p.saucerActive).length,
    encounter: probes.at(-1)?.encounter,
  };
  const loopProof = (acceleratedLoop || realtimeLoop) ? {
    firstPlay: probes.find(p => p.play)?.frame ?? null,
    firstAlienHit: probes.find(p => p.aliens > 0 && p.aliens < 55)?.frame ?? null,
    firstNextRound: probes.find(p => p.round > 0)?.frame ?? null,
    firstGameOver: (() => { const first = probes.findIndex(p => p.play); return probes.slice(first + 1).find(p => !p.play)?.frame ?? null; })(),
    secondPlay: (() => { const first = probes.findIndex(p => p.play); const over = probes.findIndex((p, i) => i > first && !p.play); return probes.slice(over + 1).find(p => p.play)?.frame ?? null; })(),
    maxScore: Math.max(...probes.map(p => p.score)),
  } : undefined;
  const shieldProof = shieldReview ? probes.filter(p => [540, 1005, 1995, 3000, 4995].includes(p.frame)).map(p => ({ frame: p.frame, bits: p.shieldBits, hostileLive: !!(p.alienShot2 & 0x80) })) : undefined;
  const damageProof = damageReview ? {
    firstPlay: probes.find(p => p.play)?.frame ?? null,
    firstHitAnimation: probes.find(p => p.play && p.shipAnim !== 0xff)?.frame ?? null,
    firstReserveLoss: probes.find(p => p.play && p.ships < 2)?.frame ?? null,
    minimumReserves: Math.min(...probes.filter(p => p.play).map(p => p.ships)),
    hostileLiveSamples: probes.filter(p => p.alienShot2 & 0x80).length,
  } : undefined;
  const edgeSamples = edgeReview ? probes.filter(p => [675, 1740, 1830, 2190].includes(p.frame)).map(p => ({ frame: p.frame, play: p.play, aliens: p.aliens, fleetDir: p.fleetDir, headerCells: p.headerCells, headerBits: p.headerBits })) : undefined;
  delete result.probes;
  console.log(JSON.stringify({ result, inputProof, loopProof, shieldProof, damageProof, probeCount: probes.length, edgeSamples, errors }));
  const loopOrderValid = !(acceleratedLoop || realtimeLoop) ||
    (Object.values(loopProof).every(value => Number.isFinite(value) && value > 0) &&
      loopProof.firstPlay < loopProof.firstAlienHit &&
      loopProof.firstAlienHit < loopProof.firstNextRound &&
      loopProof.firstNextRound < loopProof.firstGameOver &&
      loopProof.firstGameOver < loopProof.secondPlay && loopProof.maxScore > 0);
  const shieldValid = !shieldReview ||
    (inputProof.coin && inputProof.start && inputProof.play && shieldProof.length === 5 &&
      (dataSha256 === baselineDataSha256
        ? shieldProof.every(sample => sample.bits === shieldProof[0].bits) && inputProof.alienShot2LiveSamples === 0
        : shieldProof[0].bits > Math.min(...shieldProof.slice(1).map(sample => sample.bits)) && inputProof.alienShot2LiveSamples > 0));
  const damageValid = !damageReview || (shot2Experiment && inputProof.coin && inputProof.start && Number.isFinite(damageProof.firstHitAnimation) && Number.isFinite(damageProof.firstReserveLoss) && damageProof.minimumReserves < 2 && damageProof.hostileLiveSamples > 0);
  if (result.error || errors.length || !result.ready || result.frames < (realtimeLoop ? 23_000 : damageReview ? 9000 : shieldReview ? 5000 : acceleratedLoop ? 40_000 : 670) || result.nonblack < 10 || result.audioEnabled || (saucerExperiment && acceleratedLoop && inputProof.saucerActiveSamples === 0) || (!acceleratedLoop && !realtimeLoop && !shieldReview && !damageReview && (!inputProof.coin || !inputProof.start || !inputProof.right || !inputProof.fire || !inputProof.play || !inputProof.moved || !inputProof.shot)) || !loopOrderValid || !shieldValid || !damageValid) process.exitCode = 1;
  await page.close();
} finally {
  if (browser) await browser.close();
  await new Promise(done => server.close(done));
}
