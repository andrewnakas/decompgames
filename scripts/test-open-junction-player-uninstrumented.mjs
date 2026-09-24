// Silent end-to-end backup smoke for the actual shared player and release-like
// Open Junction binary. This CI preview is never deployed.
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from '@playwright/test';

const origin = 'http://127.0.0.1:4322';
const server = spawn(process.execPath, ['scripts/serve.mjs'], { stdio: 'ignore' });
let browser;
try {
  let listening = false;
  for (let attempt = 0; attempt < 40; ++attempt) {
    if (server.exitCode !== null) throw new Error(`Private preview exited: ${server.exitCode}`);
    try {
      if ((await fetch(`${origin}/play/shortline/`)).ok) { listening = true; break; }
    } catch { /* preview is still starting */ }
    await delay(250);
  }
  if (!listening) throw new Error('Private player preview did not start');
  browser = await chromium.launch({ headless: true, args: ['--mute-audio'] });
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 }, acceptDownloads: true });
  const errors = [], remoteRequests = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => {
    if (route.request().url().startsWith(origin)) return route.continue();
    remoteRequests.push(route.request().url());
    return route.abort();
  });
  const start = async () => {
    await page.locator('#start-game').click();
    await page.waitForFunction(() =>
      document.querySelector('#player-status')?.textContent?.includes('Engine running'),
    null, { timeout: 35_000 });
    if (await page.locator('#toggle-sound').textContent() !== 'Sound: off')
      throw new Error('Shared player did not keep sound off');
    const frame = page.frame({ url: /\/engine\/\?game=shortline/ });
    if (!frame) throw new Error('Shared player engine frame is absent');
    if (await frame.evaluate(() => typeof window.Module?._oj_trace_mouse_state !== 'undefined'))
      throw new Error('Release-like player unexpectedly includes a private trace hook');
    return frame;
  };
  const menuVisible = async frame => {
    const png = await frame.locator('canvas').screenshot();
    return frame.evaluate(async base64 => {
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
  const waitForMenu = async frame => {
    for (let attempt = 0; attempt < 25; ++attempt) {
      if (await menuVisible(frame)) return;
      await delay(1_000);
    }
    throw new Error('Shared player did not reach the Open Junction main menu');
  };
  const enterGameplay = async frame => {
    await frame.locator('canvas').focus();
    for (let attempt = 0; attempt < 6; ++attempt) {
      await page.keyboard.press('g');
      await delay(2_000);
      if (!(await menuVisible(frame))) return;
    }
    throw new Error('Shared player did not leave the main menu after Go');
  };
  const saveFiles = frame => frame.evaluate(() => window.Module.FS.readdir('/persistent')
    .filter(name => /^[0-9]{3}[a-z]{2}[0-9]{3}\.[0-9]{2}_$/.test(name))
    .map(name => ({ path: `/persistent/${name}`, size: window.Module.FS.stat(`/persistent/${name}`).size })));

  await page.goto(`${origin}/play/shortline/`, { waitUntil: 'domcontentloaded' });
  if (await page.locator('#toggle-sound').textContent() !== 'Sound: off')
    throw new Error('Shared player did not start with sound off');
  let frame = await start();
  await waitForMenu(frame);
  await enterGameplay(frame);
  await delay(8_000);
  await page.keyboard.press('p');
  await delay(2_000);
  await page.keyboard.press('s');
  let files = [];
  for (let attempt = 0; attempt < 12; ++attempt) {
    files = await saveFiles(frame);
    if (files.some(file => file.size > 0)) break;
    await delay(1_000);
  }
  if (!files.some(file => file.size > 0))
    throw new Error('Release-like shared player did not save locally');
  const downloadPromise = page.waitForEvent('download', { timeout: 10_000 });
  await page.locator('#export-save').click();
  const backup = JSON.parse(await readFile(await (await downloadPromise).path(), 'utf8'));
  if (backup.game !== 'shortline' || backup.version !== 'open-junction-private-1' ||
      !backup.files.some(file => files.some(item => item.path === file.path && item.size === file.data.length)))
    throw new Error('Release-like player exported an incomplete backup');
  page.once('dialog', dialog => dialog.accept());
  await page.locator('#delete-save').click();
  await page.locator('#start-game').waitFor({ state: 'visible', timeout: 15_000 });
  frame = await start();
  if ((await saveFiles(frame)).length) throw new Error('Shared player did not delete the local save');
  page.once('dialog', dialog => dialog.accept());
  await page.locator('#import-save').setInputFiles({
    name: 'open-junction-private-backup.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(backup)),
  });
  await page.locator('#start-game').waitFor({ state: 'visible', timeout: 15_000 });
  frame = await start();
  if (!(await saveFiles(frame)).some(file => files.some(item => item.path === file.path && item.size === file.size)))
    throw new Error('Shared player did not restore the imported save');
  await waitForMenu(frame);
  await frame.locator('canvas').focus();
  await page.keyboard.press('a');
  await delay(2_000);
  await enterGameplay(frame);
  if (errors.length || remoteRequests.length)
    throw new Error(`Release-like player errors: ${JSON.stringify({ errors, remoteRequests })}`);
  console.log('Release-like shared player launched, saved, exported, deleted, imported, and resumed silently.');
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
