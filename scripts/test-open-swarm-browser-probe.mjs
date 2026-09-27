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
const excluded = ['.', ':(exclude)games/invaders/idiomatic/reverseFleetAtEdge.js'];
if (trailExperiment) excluded.push(':(exclude)games/invaders/idiomatic/drawPendingAlien.js');
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
    if (pathname === '/web/worker.js') {
      // Private observation only: emit a small state sample without changing
      // game execution, input, renderer, or the upstream checkout on disk.
      const source = bytes.toString('utf8').replaceAll('\r\n', '\n');
      const anchor = 'function serviceIdiomaticFrame(machine, frameIndex) {\n  readInputsInto(machine);';
      if (!source.includes(anchor)) throw Error('Upstream worker telemetry anchor changed');
      bytes = Buffer.from(source.replace(anchor, `${anchor}\n  if (frameIndex % 15 === 0 || (Atomics.load(ctrl, 1) & 5)) { const header = Array.from({ length: 28 }, (_, glyph) => Array.from({ length: 8 }, (_, row) => machine.mem8[0x241e + glyph * 0x100 + row * 0x20])); postMessage({ type: 'probe', frame: frameIndex, in1: Atomics.load(ctrl, 1), play: machine.mem8[0x20ef], shipX: machine.mem8[0x201b], shot: machine.mem8[0x2025], aliens: machine.mem8[0x2082], fleetDir: machine.mem8[0x200d], headerCells: header.filter(bytes => bytes.some(Boolean)).length, headerBits: header.flat().reduce((sum, byte) => { while (byte) { sum += byte & 1; byte >>= 1; } return sum; }, 0) }); }`));
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
  const waitFrame = n => page.waitForFunction(min => window.__openSwarm.frames >= min || window.__openSwarm.error, n, { timeout: 30_000 });
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
  if (edgeReview) {
    await page.locator('canvas').screenshot({ path: '.cache/open-swarm-frame670.png' });
    await page.waitForFunction(() => window.__openSwarm.frames >= 1840 || window.__openSwarm.error, null, { timeout: 60_000 });
    await page.locator('canvas').screenshot({ path: '.cache/open-swarm-frame1840.png' });
    if (headerReview) {
      await page.waitForFunction(() => window.__openSwarm.frames >= 2200 || window.__openSwarm.error, null, { timeout: 30_000 });
      await page.locator('canvas').screenshot({ path: '.cache/open-swarm-frame2200.png' });
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
  };
  const edgeSamples = edgeReview ? probes.filter(p => [675, 1740, 1830, 2190].includes(p.frame)).map(p => ({ frame: p.frame, play: p.play, aliens: p.aliens, fleetDir: p.fleetDir, headerCells: p.headerCells, headerBits: p.headerBits })) : undefined;
  delete result.probes;
  console.log(JSON.stringify({ result, inputProof, probeCount: probes.length, edgeSamples, errors }));
  if (result.error || errors.length || !result.ready || result.frames < 670 || result.nonblack < 10 || result.audioEnabled || !inputProof.coin || !inputProof.start || !inputProof.right || !inputProof.fire || !inputProof.play || !inputProof.moved || !inputProof.shot) process.exitCode = 1;
  await page.close();
} finally {
  if (browser) await browser.close();
  await new Promise(done => server.close(done));
}
