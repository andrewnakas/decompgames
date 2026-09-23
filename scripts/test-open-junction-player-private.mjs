// CI-only exercise of the real Decomp Games player against an ephemeral,
// replacement-only Open Junction build. The fixture is never deployed.
import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
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
  if (errors.length || remoteRequests.length)
    throw new Error(`Private shared-player errors: ${JSON.stringify({ errors, remoteRequests })}`);
  console.log('Private shared-player launch passed with sound off and no remote requests.');
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
