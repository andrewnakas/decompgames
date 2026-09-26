// Silent browser smoke for the build that has no private trace hooks.
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { chromium } from '@playwright/test';

if (!process.argv[2]) throw new Error('Usage: node test-open-junction-uninstrumented.mjs BUILD_DIRECTORY');
const directory = resolve(process.argv[2]);
const html = `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;background:#07111b">
<canvas id="canvas" width="640" height="480" tabindex="0"></canvas>
<script>
window.__oj = { ready: false, abort: '' };
var Module = {
  canvas: document.getElementById('canvas'),
  preRun: [function () {
    Module.FS.mkdirTree('/persistent');
    Module.FS.mount(Module.IDBFS, {}, '/persistent');
    Module.addRunDependency('restore-saves');
    Module.FS.syncfs(true, (error) => {
      if (error) window.__oj.abort = 'Save restore failed: ' + error;
      Module.removeRunDependency('restore-saves');
    });
  }],
  onRuntimeInitialized() { window.__oj.ready = true; },
  onAbort(reason) { window.__oj.abort = String(reason); }
};
</script><script src="/resl.js"></script></body></html>`;
const server = createServer(async (request, response) => {
  try {
    const name = new URL(request.url, 'http://localhost').pathname;
    if (name === '/') {
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(html);
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
    }).end(content);
  } catch (error) { response.writeHead(500).end(String(error)); }
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const base = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({ headless: true, args: ['--mute-audio'] });
  const page = await browser.newPage({ viewport: { width: 640, height: 480 } });
  const errors = [];
  const remoteRequests = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => {
    if (route.request().url().startsWith(base)) return route.continue();
    remoteRequests.push(route.request().url());
    return route.abort();
  });
  await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 20_000 });
  await page.waitForFunction(() => window.__oj.ready || window.__oj.abort, null, { timeout: 20_000 });
  if (await page.evaluate(() => window.__oj.abort)) throw new Error('Uninstrumented engine aborted at startup');
  if (await page.evaluate(() => typeof window.Module._oj_trace_mouse_state) !== 'undefined')
    throw new Error('Release-like runtime still exports a private trace hook');
  const mainMenuIsVisible = async () => {
    const png = await page.locator('canvas').screenshot();
    return page.evaluate(async (base64) => {
      const image = new Image();
      image.src = `data:image/png;base64,${base64}`;
      await image.decode();
      const scratch = document.createElement('canvas');
      scratch.width = image.width; scratch.height = image.height;
      const context = scratch.getContext('2d');
      context.drawImage(image, 0, 0);
      return [[250, 120], [250, 200], [390, 390]].every(([x, y]) => {
        const pixel = context.getImageData(x, y, 1, 1).data;
        return pixel[0] === 129 && pixel[1] === 160 && pixel[2] === 190;
      });
    }, png.toString('base64'));
  };
  let sawMenu = false;
  for (let attempt = 0; attempt < 20; ++attempt) {
    if (await mainMenuIsVisible()) { sawMenu = true; break; }
    await page.waitForTimeout(1_000);
  }
  if (!sawMenu) throw new Error('Uninstrumented runtime did not reach its main menu');
  await page.locator('canvas').focus();
  let enteredGameplay = false;
  for (let attempt = 0; attempt < 6; ++attempt) {
    await page.keyboard.press('g');
    await page.waitForTimeout(2_000);
    if (!(await mainMenuIsVisible())) { enteredGameplay = true; break; }
  }
  if (!enteredGameplay) throw new Error('Go input did not leave the uninstrumented main menu');
  await page.waitForTimeout(8_000);
  const gameplay = await page.locator('canvas').screenshot();
  const gridSamples = await page.evaluate(async (base64) => {
    const image = new Image();
    image.src = `data:image/png;base64,${base64}`;
    await image.decode();
    const scratch = document.createElement('canvas');
    scratch.width = image.width; scratch.height = image.height;
    const context = scratch.getContext('2d');
    context.drawImage(image, 0, 0);
    return [220, 300].flatMap(y => [32, 64, 96, 128].map(x =>
      [...context.getImageData(x, y, 1, 1).data].slice(0, 3)));
  }, gameplay.toString('base64'));
  if (gridSamples.filter(rgb => rgb[0] === 129 && rgb[1] === 160 && rgb[2] === 190).length < 5)
    throw new Error('Independent board did not appear after Go in the uninstrumented build');
  // Observe the release-like header change during ordinary play. Compare only
  // the year glyph region so scenery motion cannot satisfy this assertion.
  const yearPixels = png => page.evaluate(async base64 => {
    const image = new Image();
    image.src = `data:image/png;base64,${base64}`;
    await image.decode();
    const scratch = document.createElement('canvas');
    scratch.width = image.width; scratch.height = image.height;
    const context = scratch.getContext('2d');
    context.drawImage(image, 0, 0);
    return [...context.getImageData(272, 25, 64, 16).data];
  }, png.toString('base64'));
  const initialYearPixels = await yearPixels(gameplay);
  await page.keyboard.press('3');
  let naturalYearImage;
  let changedYearPixels = 0;
  for (let attempt = 0; attempt < 15; ++attempt) {
    await page.waitForTimeout(2_000);
    naturalYearImage = await page.locator('canvas').screenshot();
    const current = await yearPixels(naturalYearImage);
    changedYearPixels = current.reduce((count, value, index) =>
      count + Number(value !== initialYearPixels[index]), 0);
    if (changedYearPixels > 30) break;
  }
  if (changedYearPixels <= 30)
    throw new Error('Uninstrumented year glyphs did not visibly advance during ordinary play');
  await writeFile('/tmp/open-junction-uninstrumented-natural-year.png', naturalYearImage);
  console.log('Uninstrumented ordinary year-header changed color channels:', changedYearPixels);
  // The board is visible behind the menu, so the menu-disappearance check
  // above is the actual proof that Go entered gameplay before Save is tested.
  await writeFile('/tmp/open-junction-uninstrumented-before-pause.png',
    await page.locator('canvas').screenshot());
  await page.keyboard.press('p');
  await page.waitForTimeout(2_000);
  await writeFile('/tmp/open-junction-uninstrumented-pause.png',
    await page.locator('canvas').screenshot());
  await page.keyboard.press('s');
  let saved = false;
  for (let attempt = 0; attempt < 10; ++attempt) {
    await page.waitForTimeout(1_000);
    saved = await page.evaluate(() => window.Module.FS.readdir('/persistent').some(name =>
      /^[0-9]{3}[a-z]{2}[0-9]{3}\.[0-9]{2}_$/.test(name) &&
      window.Module.FS.stat(`/persistent/${name}`).size > 0));
    if (saved) break;
  }
  if (!saved) {
    await writeFile('/tmp/open-junction-uninstrumented-after-save.png',
      await page.locator('canvas').screenshot());
    const files = await page.evaluate(() => window.Module.FS.readdir('/persistent').map(name => ({
      name, bytes: name === '.' || name === '..' ? 0 : window.Module.FS.stat(`/persistent/${name}`).size,
    })));
    throw new Error(`Uninstrumented build did not create a nonempty local save: ${JSON.stringify({ files, errors, remoteRequests })}`);
  }
  if (errors.length || remoteRequests.length || await page.evaluate(() => window.__oj.abort))
    throw new Error(`Uninstrumented browser error: ${JSON.stringify({ errors, remoteRequests })}`);
  console.log('Uninstrumented null-audio build launched, accepted Go, drew the independent board, and saved locally.');
} finally {
  await browser?.close();
  await new Promise(resolveClose => server.close(resolveClose));
}
