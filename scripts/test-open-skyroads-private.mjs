// Silent exploratory browser probe of the independently authored SkyRoads data.
// This is not a release gate or a verified gameplay test.
import { spawn } from 'node:child_process';
import { get } from 'node:http';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from '@playwright/test';

const root = resolve(process.argv[2] || '.cache/open-skyways-ci/build');
const origin = 'http://127.0.0.1:4325';
const server = spawn('python', ['-m', 'http.server', '4325', '--bind', '127.0.0.1'], {
  cwd: root, stdio: 'ignore', windowsHide: true,
});
let browser;
const isReady = () => new Promise(resolve => {
  const request = get(`${origin}/skyroads.html`, response => {
    response.resume();
    resolve(response.statusCode === 200);
  });
  request.on('error', () => resolve(false));
});
try {
  let ready = false;
  for (let attempt = 0; attempt < 40; ++attempt) {
    if (await isReady()) { ready = true; break; }
    await delay(250);
  }
  if (!ready) throw new Error('Private preview did not start');
  browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--mute-audio'] });
  const page = await browser.newPage({ viewport: { width: 1100, height: 850 } });
  const errors = [], remote = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  await page.route('**/*', route => {
    if (route.request().url().startsWith(origin)) return route.continue();
    remote.push(route.request().url());
    return route.abort();
  });
  await page.goto(`${origin}/skyroads.html`, { waitUntil: 'domcontentloaded' });
  const canvas = page.locator('canvas');
  await canvas.waitFor({ state: 'visible', timeout: 30_000 });
  await delay(4_000);
  await mkdir('test-results/open-skyroads-private', { recursive: true });
  await writeFile('test-results/open-skyroads-private/intro.png', await canvas.screenshot());
  await canvas.click();
  await page.keyboard.press('Enter');
  await delay(5_000);
  await writeFile('test-results/open-skyroads-private/menu.png', await canvas.screenshot());
  await page.keyboard.press('Enter');
  await delay(5_000);
  await writeFile('test-results/open-skyroads-private/chooser.png', await canvas.screenshot());
  await page.keyboard.press('Enter');
  await delay(5_000);
  await writeFile('test-results/open-skyroads-private/road.png', await canvas.screenshot());
  await page.keyboard.down('ArrowUp');
  for (const seconds of [10, 20, 30, 40]) {
    await delay(10_000);
    await writeFile(`test-results/open-skyroads-private/accelerating-${seconds}.png`, await canvas.screenshot());
  }
  await page.keyboard.up('ArrowUp');
  await page.keyboard.press('Enter');
  await delay(3_000);
  await writeFile('test-results/open-skyroads-private/chooser-after-completion.png', await canvas.screenshot());
  const cfg = await page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('/save');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const files = await new Promise((resolve, reject) => {
      const request = db.transaction('FILE_DATA', 'readonly').objectStore('FILE_DATA').getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return files.map(file => ({ bytes: file.contents?.length, firstCompletion: file.contents?.[6] | file.contents?.[7] << 8 }));
  });
  if (!cfg.some(file => file.bytes === 66 && file.firstCompletion > 0)) {
    throw new Error(`Browser progress was not saved: ${JSON.stringify(cfg)}`);
  }
  console.log('IndexedDB completion record:', JSON.stringify(cfg));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await delay(4_000);
  await page.keyboard.press('Enter');
  await delay(3_000);
  await page.keyboard.press('Enter');
  await delay(3_000);
  await writeFile('test-results/open-skyroads-private/chooser-after-reload.png', await canvas.screenshot());
  await page.keyboard.press('Enter');
  await delay(3_000);
  await page.keyboard.down('ArrowRight');
  await delay(1_000);
  await page.keyboard.up('ArrowRight');
  await writeFile('test-results/open-skyroads-private/steered-right.png', await canvas.screenshot());
  await page.keyboard.down('Space');
  await delay(350);
  await writeFile('test-results/open-skyroads-private/jump.png', await canvas.screenshot());
  await page.keyboard.up('Space');
  if (errors.length || remote.length) throw new Error(JSON.stringify({ errors, remote }));
  console.log('Private muted first-course screenshots captured; review visuals and reload state before release.');
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
