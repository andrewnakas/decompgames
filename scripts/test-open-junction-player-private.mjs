// CI-only exercise of the real Decomp Games player against an ephemeral,
// replacement-only Open Junction build. The fixture is never deployed.
import { spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from '@playwright/test';

const origin = 'http://127.0.0.1:4322';
const server = spawn(process.execPath, ['scripts/serve.mjs'], { stdio: ['ignore', 'pipe', 'pipe'] });
let browser;
try {
  let listening = false;
  for (let attempt = 0; attempt < 40; ++attempt) {
    if (server.exitCode !== null) throw new Error(`Private preview exited: ${server.exitCode}`);
    try {
      const response = await fetch(`${origin}/play/shortline/`);
      if (response.ok) { listening = true; break; }
    } catch { /* wait for the preview listener */ }
    await delay(250);
  }
  if (!listening) throw new Error('Private player preview did not start');
  browser = await chromium.launch({ headless: true, args: ['--mute-audio'] });
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 }, acceptDownloads: true });
  const errors = [], remoteRequests = [], engineLogs = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.text().includes('OJ ')) engineLogs.push(message.text());
  });
  await page.route('**/*', route => {
    if (route.request().url().startsWith(origin)) return route.continue();
    remoteRequests.push(route.request().url());
    return route.abort();
  });
  await page.goto(`${origin}/play/shortline/`, { waitUntil: 'domcontentloaded' });
  if (!await page.locator('#start-game').isVisible())
    throw new Error('Private player start control is missing');
  if (await page.locator('#toggle-sound').textContent() !== 'Sound: off')
    throw new Error('Private player did not default to silent audio');
  await page.locator('#start-game').click();
  await page.waitForFunction(() =>
    document.querySelector('#player-status')?.textContent?.includes('Engine running'),
  null, { timeout: 35_000 });
  if (await page.locator('#toggle-sound').textContent() !== 'Sound: off')
    throw new Error('Private player enabled audible output');
  const frame = page.frame({ url: /\/engine\/\?game=shortline/ });
  if (!frame) throw new Error('Shared engine iframe did not load');
  for (let attempt = 0; attempt < 15 && !engineLogs.some(line => line.includes('OJ menu frame')); ++attempt)
    await delay(1_000);
  if (!engineLogs.some(line => line.includes('OJ menu frame')))
    throw new Error(`Shared engine menu was not ready: ${JSON.stringify(engineLogs.slice(-8))}`);
  await frame.locator('canvas').focus();
  await page.keyboard.press('g');
  for (let attempt = 0; attempt < 10 && !engineLogs.some(line => line.includes('OJ stage: after main menu')); ++attempt)
    await delay(1_000);
  console.log('Private shared-player engine traces:', engineLogs.filter(line => line.includes('OJ stage:')).slice(-8));
  if (!engineLogs.some(line => line.includes('OJ stage: after main menu')))
    throw new Error('Shared player did not enter Open Junction gameplay after Go');
  const canvasSize = await frame.locator('canvas').evaluate(canvas =>
    ({ width: canvas.width, height: canvas.height }));
  if (canvasSize.width < 640 || canvasSize.height < 480)
    throw new Error(`Unexpected shared-player canvas size: ${JSON.stringify(canvasSize)}`);
  console.log('Private shared-player canvas size:', canvasSize);
  if (process.env.OPEN_JUNCTION_PLAYER_SCREENSHOT)
    await writeFile(process.env.OPEN_JUNCTION_PLAYER_SCREENSHOT,
      await frame.locator('canvas').screenshot({ timeout: 5_000 }));
  // Exercise the user-facing backup controls across the parent/iframe boundary.
  await page.keyboard.press('p');
  await delay(1_000);
  await page.keyboard.press('s');
  const saveFiles = () => frame.evaluate(() => window.Module.FS.readdir('/persistent')
    .filter(name => /^[0-9]{3}[a-z]{2}[0-9]{3}\.[0-9]{2}_$/.test(name))
    .map(name => ({ path: `/persistent/${name}`, size: window.Module.FS.stat(`/persistent/${name}`).size })));
  let saved = [];
  for (let attempt = 0; attempt < 10; ++attempt) {
    saved = await saveFiles();
    if (saved.some(file => file.size > 0)) break;
    await delay(1_000);
  }
  if (!saved.some(file => file.size > 0))
    throw new Error('Shared player Save did not create a nonempty local file');
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#export-save').click();
  const download = await downloadPromise;
  const backup = JSON.parse(await readFile(await download.path(), 'utf8'));
  if (backup.game !== 'shortline' || backup.version !== 'open-junction-private-1' ||
      !backup.files.some(file => saved.some(item => item.path === file.path && item.size === file.data.length)))
    throw new Error('Shared player exported an incomplete or mismatched save backup');
  page.once('dialog', dialog => dialog.accept());
  await page.locator('#delete-save').click();
  await page.locator('#start-game').waitFor({ state: 'visible', timeout: 15_000 });
  await page.locator('#start-game').click();
  await page.waitForFunction(() =>
    document.querySelector('#player-status')?.textContent?.includes('Engine running'),
  null, { timeout: 35_000 });
  const emptyFrame = page.frame({ url: /\/engine\/\?game=shortline/ });
  if (!emptyFrame || (await emptyFrame.evaluate(() => window.Module.FS.readdir('/persistent')))
    .some(name => /^[0-9]{3}[a-z]{2}[0-9]{3}\.[0-9]{2}_$/.test(name)))
    throw new Error('Shared player did not delete local saved data');
  page.once('dialog', dialog => dialog.accept());
  await page.locator('#import-save').setInputFiles({
    name: 'decompgames-shortline-saves.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(backup)),
  });
  await page.locator('#start-game').waitFor({ state: 'visible', timeout: 15_000 });
  await page.locator('#start-game').click();
  await page.waitForFunction(() =>
    document.querySelector('#player-status')?.textContent?.includes('Engine running'),
  null, { timeout: 35_000 });
  const restoredFrame = page.frame({ url: /\/engine\/\?game=shortline/ });
  const restored = await restoredFrame?.evaluate(() => window.Module.FS.readdir('/persistent')
    .filter(name => /^[0-9]{3}[a-z]{2}[0-9]{3}\.[0-9]{2}_$/.test(name))
    .map(name => ({ path: `/persistent/${name}`, size: window.Module.FS.stat(`/persistent/${name}`).size })));
  if (!restored?.some(file => saved.some(item => item.path === file.path && item.size === file.size)))
    throw new Error('Shared player did not restore the imported backup');
  if (errors.length || remoteRequests.length)
    throw new Error(`Private shared-player errors: ${JSON.stringify({ errors, remoteRequests })}`);
  if (await page.locator('#toggle-sound').textContent() !== 'Sound: off')
    throw new Error('Private shared player enabled audible output during save round trip');
  console.log('Private shared-player launch and backup round trip passed with sound off and no remote requests.');
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
