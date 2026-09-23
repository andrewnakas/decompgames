// Private, silent browser smoke test. A passing result is not a gameplay test.
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { chromium } from '@playwright/test';

const directory = resolve(process.argv[2] || '');
if (!process.argv[2]) throw new Error('Usage: node test-open-junction-private.mjs BUILD_DIRECTORY');
const html = `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;background:#07111b">
<canvas id="canvas" width="640" height="350" tabindex="0"></canvas>
<script>
window.__oj = { ready: false, abort: '', stderr: [] };
var Module = {
  canvas: document.getElementById('canvas'),
  onRuntimeInitialized() { window.__oj.ready = true; },
  onAbort(reason) { window.__oj.abort = String(reason); },
  printErr(message) { window.__oj.stderr.push(String(message)); }
};
</script><script src="/resl.js"></script></body></html>`;

const server = createServer(async (request, response) => {
  const name = new URL(request.url, 'http://localhost').pathname;
  if (name === '/') {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end(html);
    return;
  }
  if (!['/resl.js', '/resl.wasm'].includes(name)) {
    response.writeHead(404).end();
    return;
  }
  const content = await readFile(join(directory, name.slice(1)));
  response.writeHead(200, {
    'content-type': name.endsWith('.wasm') ? 'application/wasm' : 'text/javascript',
    'cache-control': 'no-store',
  });
  response.end(content);
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const base = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({ headless: true, args: ['--mute-audio'] });
  const page = await browser.newPage({ viewport: { width: 640, height: 350 } });
  const pageErrors = [];
  const remoteRequests = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.route('**/*', (route) => {
    if (route.request().url().startsWith(base)) return route.continue();
    remoteRequests.push(route.request().url());
    return route.abort();
  });
  await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 20_000 });
  await page.waitForTimeout(12_000);
  const state = await page.evaluate(() => ({
    ...window.__oj,
    canvas: {
      width: document.querySelector('canvas')?.width,
      height: document.querySelector('canvas')?.height,
    },
  }));
  const before = createHash('sha256').update(await page.screenshot()).digest('hex');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(3_000);
  const after = createHash('sha256').update(await page.screenshot()).digest('hex');
  console.log(JSON.stringify({ state, before, after, pageErrors, remoteRequests }, null, 2));
  if (!state.ready || state.abort || pageErrors.length || remoteRequests.length)
    throw new Error('Private browser boot failed');
  if (state.canvas.width < 320 || state.canvas.height < 200)
    throw new Error('Game canvas has an unexpected size');
} finally {
  await browser?.close();
  await new Promise((done) => server.close(done));
}
