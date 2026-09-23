// Private, silent browser smoke test. A passing result is not a gameplay test.
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
  printErr(message) { window.__oj.stderr.push(String(message)); console.log('engine: ' + message); }
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
  page.on('console', (message) => {
    if (message.text().startsWith('engine: OJ ')) console.log(message.text());
  });
  await page.route('**/*', (route) => {
    if (route.request().url().startsWith(base)) return route.continue();
    remoteRequests.push(route.request().url());
    return route.abort();
  });
  await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 20_000 });
  console.log('Private page navigation completed.');
  const readState = () => page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    return { ...window.__oj, canvas: { width: canvas?.width, height: canvas?.height } };
  });
  // The independent six-station schedule passed an 18-second idle run. Now
  // test whether the Go shortcut exits the menu without claiming gameplay.
  let elapsed = 0;
  for (const delay of [3_000]) {
    await page.waitForTimeout(delay);
    elapsed += delay;
    const state = await readState();
    console.log(`Passive ${elapsed}ms:`, JSON.stringify({ state, pageErrors, remoteRequests }));
    if (!state.ready || state.abort || pageErrors.length || remoteRequests.length)
      throw new Error('Private browser boot failed');
    if (state.canvas.width < 320 || state.canvas.height < 200)
      throw new Error('Game canvas has an unexpected size');
  }
  await page.locator('canvas').focus();
  await page.keyboard.press('g', { timeout: 5_000 });
  console.log('Go key delivered to focused game canvas.');
  for (const delay of [3_000, 5_000]) {
    await page.waitForTimeout(delay);
    elapsed += delay;
    const state = await readState();
    console.log(`After Go ${elapsed}ms:`, JSON.stringify({ state, pageErrors, remoteRequests }));
    if (state.abort || pageErrors.length || remoteRequests.length)
      throw new Error('Private browser encountered an error after Go');
    if (!state.stderr.some((message) => message.includes('OJ stage: after main menu')))
      throw new Error('Go did not exit the main menu in the private smoke');
  }
} finally {
  await browser?.close();
  await new Promise((done) => server.close(done));
}
