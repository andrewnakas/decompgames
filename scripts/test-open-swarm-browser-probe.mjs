// Private silent browser integration check; this is not a release gameplay gate.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, join, extname, sep } from 'node:path';
import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const checkout = resolve(process.argv[2] || '.cache/arcade-js');
const dataFile = resolve(process.argv[3] || '.cache/open-swarm-draft/open-swarm-draft.bin');
const probeFile = resolve('experiments/open-swarm-browser-probe.html');
const revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: checkout, encoding: 'utf8' }).trim();
if (revision !== 'e849d086f4168c9a0e1ab501d62efbe3766def8a') throw Error(`Unexpected arcade-js revision ${revision}`);
const patch = execFileSync('git', ['diff', '--binary', '--', 'games/invaders/idiomatic/reverseFleetAtEdge.js'], { cwd: checkout });
const patchSha256 = createHash('sha256').update(patch).digest('hex');
if (patchSha256 !== 'e1242a57f67d90444be041d9a5f1ea5b6f994b0934bd828f9311e7e73153aad7') throw Error(`Unexpected edge patch ${patchSha256}`);
const otherChanges = execFileSync('git', ['diff', '--name-only', '--', '.', ':(exclude)games/invaders/idiomatic/reverseFleetAtEdge.js'], { cwd: checkout, encoding: 'utf8' }).trim();
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
    const bytes = await readFile(file);
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
  await page.keyboard.press('Digit5');
  await page.waitForTimeout(200);
  await page.keyboard.press('Digit1');
  await page.keyboard.down('Space');
  await page.keyboard.down('ArrowRight');
  await page.waitForFunction(() => window.__openSwarm.frames >= 240 || window.__openSwarm.error, null, { timeout: 30_000 });
  await page.keyboard.up('ArrowRight');
  await page.keyboard.up('Space');
  const result = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    let nonblack = 0;
    for (let i = 0; i < pixels.length; i += 4) if (pixels[i] || pixels[i + 1] || pixels[i + 2]) nonblack++;
    return { ...window.__openSwarm, nonblack, canvas: [canvas.width, canvas.height] };
  });
  console.log(JSON.stringify({ result, errors }));
  if (result.error || errors.length || !result.ready || result.frames < 240 || result.nonblack < 10 || result.audioEnabled) process.exitCode = 1;
  await page.close();
} finally {
  if (browser) await browser.close();
  await new Promise(done => server.close(done));
}
