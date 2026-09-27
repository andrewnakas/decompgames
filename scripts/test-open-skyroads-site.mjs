// Silent local-site integration probe. Production and milestone status are separate.
import { chromium } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';

const origin = process.argv[2] || 'http://127.0.0.1:4326';
const errors = [], remote = [];
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--mute-audio'] });
try {
  const context = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await context.route('**/*', route => {
    if (route.request().url().startsWith(origin)) return route.continue();
    remote.push(route.request().url());
    return route.abort();
  });
  await page.goto(`${origin}/play/skyways/`);
  await page.getByRole('button', { name: 'Start game' }).click();
  await page.getByRole('status').filter({ hasText: 'Engine running' }).waitFor({ timeout: 60_000 });
  const frame = page.frameLocator('#game-frame');
  const canvas = frame.locator('#canvas');
  await canvas.click();
  await delay(2_000);
  await page.keyboard.press('Enter');
  await delay(3_000);
  await page.keyboard.press('Enter');
  await delay(3_000);
  await page.keyboard.press('Enter');
  await delay(3_000);
  await mkdir('test-results/open-skyroads-site', { recursive: true });
  await writeFile('test-results/open-skyroads-site/road.png', await canvas.screenshot());
  await page.keyboard.down('ArrowUp');
  await delay(22_000);
  await page.keyboard.up('ArrowUp');
  await writeFile('test-results/open-skyroads-site/completed.png', await canvas.screenshot());
  const downloadPromise = page.waitForEvent('download', { timeout: 8_000 });
  await page.getByRole('button', { name: 'Export saves' }).click();
  const backupDownload = await downloadPromise.catch(async error => {
    throw new Error(`No backup download: ${await page.locator('#player-status').textContent()} | ${JSON.stringify(errors)}`, { cause: error });
  });
  const backupPath = 'test-results/open-skyroads-site/skyways-save.json';
  await backupDownload.saveAs(backupPath);
  const backup = JSON.parse(await readFile(backupPath, 'utf8'));
  const config = backup.files?.find(file => file.path === '/save/skyroads.cfg');
  if (!config || config.data.length !== 66 || (config.data[6] | config.data[7] << 8) !== 1) {
    throw new Error('Exported backup does not contain the first completed road');
  }
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Delete saves' }).click();
  await page.getByRole('button', { name: 'Start game' }).click();
  await page.getByRole('status').filter({ hasText: 'Engine running' }).waitFor({ timeout: 60_000 });
  await canvas.click();
  await delay(3_000);
  await page.keyboard.press('Enter');
  await delay(4_000);
  await page.keyboard.press('Enter');
  await delay(4_000);
  await writeFile('test-results/open-skyroads-site/chooser-after-delete.png', await canvas.screenshot());
  page.once('dialog', dialog => dialog.accept());
  await page.locator('#import-save').setInputFiles(backupPath);
  await page.getByRole('button', { name: 'Start game' }).click();
  await page.getByRole('status').filter({ hasText: 'Engine running' }).waitFor({ timeout: 60_000 });
  await canvas.click();
  await delay(3_000);
  await page.keyboard.press('Enter');
  await delay(4_000);
  await page.keyboard.press('Enter');
  await delay(4_000);
  await writeFile('test-results/open-skyroads-site/chooser-restored.png', await canvas.screenshot());
  const unexpectedRemote = remote.filter(url => !url.startsWith('https://static.cloudflareinsights.com/beacon.min.js/'));
  const unexpectedErrors = errors.filter(message => message !== 'Failed to load resource: net::ERR_FAILED');
  if (unexpectedRemote.length || unexpectedErrors.length || errors.length > remote.length) {
    throw new Error(JSON.stringify({ errors, remote }));
  }
  console.log(`Site shell completed Road 01 and restored the backup silently; ${remote.length} Cloudflare analytics requests blocked.`);
} finally {
  await browser.close();
}
