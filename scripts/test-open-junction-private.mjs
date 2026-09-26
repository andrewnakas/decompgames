// Private, silent browser smoke test. A passing result is not a gameplay test.
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { chromium } from '@playwright/test';

const directory = resolve(process.argv[2] || '');
if (!process.argv[2]) throw new Error('Usage: node test-open-junction-private.mjs BUILD_DIRECTORY');
const html = `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;background:#07111b">
<canvas id="canvas" width="640" height="480" tabindex="0"></canvas>
<script>
window.__oj = { ready: false, abort: '', stderr: [] };
var Module = {
  canvas: document.getElementById('canvas'),
  preRun: [function () {
    const fs = Module.FS;
    fs.mkdirTree('/persistent');
    fs.mount(Module.IDBFS, {}, '/persistent');
    Module.addRunDependency('restore-saves');
    fs.syncfs(true, (error) => {
      if (error) window.__oj.abort = 'Save restore failed: ' + error;
      Module.removeRunDependency('restore-saves');
    });
  }],
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
  const page = await browser.newPage({ viewport: { width: 640, height: 480 } });
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
  const gameTicks = (state) => [...state.stderr].reverse().find((line) => line.startsWith('OJ game tick '));
  const before = await readState();
  if (!gameTicks(before)) throw new Error('Gameplay loop did not advance after Go');
  const initialRails = Number(gameTicks(before).match(/rails (\d+)/)?.[1]);
  const image = await page.locator('canvas').screenshot({ timeout: 5_000 });
  console.log('Private gameplay canvas PNG SHA-256:', createHash('sha256').update(image).digest('hex'));
  if (process.env.OPEN_JUNCTION_SCREENSHOT)
    await writeFile(process.env.OPEN_JUNCTION_SCREENSHOT, image);
  console.log('Opening mouse state:', await page.evaluate(() =>
    window.Module._oj_trace_mouse_state()));
  // The independently drafted board permits rails on center tile (5,5).
  // Its logical y≈210 scales to physical y≈288 in the 640×480 SDL window.
  await page.mouse.move(320, 288);
  await page.mouse.click(320, 288, { button: 'right' });
  let after;
  for (const seconds of [5, 10, 15, 20]) {
    await page.waitForTimeout(5_000);
    after = await readState();
    const latestTick = gameTicks(after);
    const latestCommit = [...after.stderr].reverse().find((line) => line.startsWith('OJ rail committed count '));
    console.log(`After build ${seconds}s:`, JSON.stringify({ latestTick, latestCommit, abort: after.abort, pageErrors, remoteRequests }));
    if (after.abort || pageErrors.length || remoteRequests.length)
      throw new Error('Private browser encountered an error while building rails');
    if (latestCommit && Number(latestCommit.match(/count (\d+)/)?.[1]) > initialRails) break;
  }
  if (!after.stderr.some((line) => line.startsWith('OJ build queued tile 5,5')) ||
      !after.stderr.some((line) => /^OJ rail committed count [2-9]/.test(line)))
    throw new Error('Center-tile rail construction was not observed');
  await page.keyboard.press('3');
  console.log('Fast-time key delivered with audio still disabled.');
  let secondEntrance = false;
  for (const seconds of [5, 10, 15, 20, 25, 30]) {
    await page.waitForTimeout(5_000);
    after = await readState();
    const latestTick = gameTicks(after);
    console.log(`After fast time ${seconds}s:`, JSON.stringify({ latestTick, abort: after.abort, pageErrors, remoteRequests }));
    if (after.abort || pageErrors.length || remoteRequests.length)
      throw new Error('Private browser encountered an error during game-time progression');
    if (Number(latestTick?.match(/entrances (\d+)/)?.[1]) >= 2) {
      secondEntrance = true;
      break;
    }
  }
  if (!secondEntrance) throw new Error('Second entrance did not appear under accelerated time');
  await page.keyboard.press('p');
  await page.waitForTimeout(2_000);
  await page.keyboard.press('g');
  console.log('Pause-and-Go keys delivered to request the next train.');
  for (const seconds of [5, 10, 15]) {
    await page.waitForTimeout(5_000);
    after = await readState();
    const spawn = [...after.stderr].reverse().find((line) => line.startsWith('OJ train spawned from '));
    console.log(`After resume ${seconds}s:`, JSON.stringify({ spawn, latestTick: gameTicks(after), abort: after.abort, pageErrors, remoteRequests }));
    if (after.abort || pageErrors.length || remoteRequests.length)
      throw new Error('Private browser encountered an error during train dispatch');
    if (spawn) break;
  }
  if (!after.stderr.some((line) => line.startsWith('OJ train spawned from ')))
    throw new Error('Train dispatch was not observed after pause and Go');
  const positions = new Set(after.stderr
    .filter((line) => /^OJ game tick .* trains [1-9]/.test(line))
    .map((line) => line.match(/head (-?\d+,-?\d+:\d+)/)?.[1])
    .filter(Boolean));
  console.log('Observed active-train head positions:', [...positions]);
  const trainImage = await page.locator('canvas').screenshot({ timeout: 5_000 });
  console.log('Private train canvas PNG SHA-256:', createHash('sha256').update(trainImage).digest('hex'));
  if (process.env.OPEN_JUNCTION_TRAIN_SCREENSHOT)
    await writeFile(process.env.OPEN_JUNCTION_TRAIN_SCREENSHOT, trainImage);
  let delivered = false;
  for (const seconds of [5, 10, 15, 20, 25, 30, 35, 40, 45]) {
    await page.waitForTimeout(5_000);
    after = await readState();
    delivered = after.stderr.some((line) => line === 'OJ train delivered');
    console.log(`After train travel ${seconds}s:`, JSON.stringify({
      delivered, latestTick: gameTicks(after), abort: after.abort, pageErrors, remoteRequests,
    }));
    if (after.abort || pageErrors.length || remoteRequests.length)
      throw new Error('Private browser encountered an error during train travel');
    if (delivered) break;
  }
  if (!delivered) throw new Error('A complete train delivery was not observed on the starter route');
  const starterTicks = after.stderr
    .filter((line) => /^OJ game tick .* entrances 2 trains \d+/.test(line));
  if (starterTicks.some((line) => Number(line.match(/ trains (\d+)/)?.[1]) > 1))
    throw new Error('Overlapping trains entered the independent single-track starter route');
  await page.keyboard.press('p');
  await page.waitForTimeout(1_000);
  await page.keyboard.press('s');
  console.log('Pause and Save keys delivered after a completed train delivery.');
  const readSaveFiles = () => page.evaluate(() => {
    const fs = window.Module?.FS;
    if (!fs) return { fsAvailable: false, files: [] };
    return {
      fsAvailable: true,
      files: fs.readdir('/persistent')
        .filter((name) => /^[0-9]{3}[a-z]{2}[0-9]{3}\.[0-9]{2}_$/.test(name))
        .map((name) => ({ name, bytes: fs.stat(`/persistent/${name}`).size })),
    };
  });
  let saved;
  for (const seconds of [2, 4, 6, 8, 10]) {
    await page.waitForTimeout(2_000);
    saved = await readSaveFiles();
    console.log(`After Save ${seconds}s:`, JSON.stringify({ saved, pageErrors, remoteRequests }));
    if (pageErrors.length || remoteRequests.length)
      throw new Error('Private browser encountered an error during Save');
    if (saved.files.some((file) => file.bytes > 0)) break;
  }
  const savedFile = saved.files.find((file) => file.bytes > 0);
  if (!savedFile) throw new Error('Pause-menu Save did not write a nonempty persistent file');
  const savedTick = gameTicks(await readState());
  const savedYear = Number(savedTick?.match(/year (\d+)/)?.[1]);
  const savedRails = Number(savedTick?.match(/rails (\d+)/)?.[1]);
  if (!Number.isFinite(savedYear) || savedYear < 1800 || savedRails < 6)
    throw new Error('Private save lacks a valid post-construction gameplay state');
  console.log('State at private save:', JSON.stringify({ savedYear, savedRails, savedTick }));
  await page.evaluate(() => new Promise((resolve, reject) => {
    window.Module.FS.syncfs(false, (error) => error ? reject(error) : resolve());
  }));
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 20_000 });
  await page.waitForFunction(() => window.__oj?.ready === true, null, { timeout: 20_000 });
  let restored;
  for (const seconds of [2, 4, 6, 8, 10]) {
    await page.waitForTimeout(2_000);
    restored = await readSaveFiles();
    console.log(`After reload ${seconds}s:`, JSON.stringify({ restored, pageErrors, remoteRequests }));
    if (restored.files.some((file) => file.name === savedFile.name && file.bytes === savedFile.bytes))
      break;
  }
  if (!restored.files.some((file) => file.name === savedFile.name && file.bytes === savedFile.bytes))
    throw new Error('Saved game file did not survive a browser reload');
  if (pageErrors.length || remoteRequests.length)
    throw new Error('Private browser encountered an error after save-file reload');
  await page.locator('canvas').focus();
  await page.keyboard.press('a');
  await page.waitForTimeout(2_000);
  await page.keyboard.press('g');
  console.log('Archive and Go keys delivered after persisted-file reload.');
  let loaded;
  for (const seconds of [2, 4, 6, 8, 10]) {
    await page.waitForTimeout(2_000);
    loaded = await readState();
    const tick = gameTicks(loaded);
    console.log(`After Archive Go ${seconds}s:`, JSON.stringify({
      tick, abort: loaded.abort, pageErrors, remoteRequests,
    }));
    if (loaded.abort || pageErrors.length || remoteRequests.length)
      throw new Error('Private browser encountered an error while loading an archived game');
    if (Number(tick?.match(/year (\d+)/)?.[1]) >= savedYear &&
        Number(tick?.match(/rails (\d+)/)?.[1]) >= savedRails) break;
  }
  const loadedTick = gameTicks(loaded);
  const loadedYear = Number(loadedTick?.match(/year (\d+)/)?.[1]);
  const loadedRails = Number(loadedTick?.match(/rails (\d+)/)?.[1]);
  if (!Number.isFinite(loadedYear) || !Number.isFinite(loadedRails) ||
      loadedYear < savedYear || loadedRails < savedRails)
    throw new Error('Archive did not restore the saved year and constructed rails');
  const backupBytes = await page.evaluate((name) =>
    Array.from(window.Module.FS.readFile(`/persistent/${name}`)), savedFile.name);
  const backupHash = createHash('sha256').update(Buffer.from(backupBytes)).digest('hex');
  console.log('Private saved-game backup SHA-256:', backupHash);
  await page.evaluate((name) => new Promise((resolve, reject) => {
    const fs = window.Module.FS;
    fs.unlink(`/persistent/${name}`);
    fs.syncfs(false, (error) => error ? reject(error) : resolve());
  }), savedFile.name);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 20_000 });
  await page.waitForFunction(() => window.__oj?.ready === true, null, { timeout: 20_000 });
  await page.waitForTimeout(2_000);
  if ((await readSaveFiles()).files.length)
    throw new Error('Deleted saved game reappeared after browser reload');
  await page.evaluate(({ name, bytes }) => new Promise((resolve, reject) => {
    const fs = window.Module.FS;
    fs.writeFile(`/persistent/${name}`, new Uint8Array(bytes));
    fs.syncfs(false, (error) => error ? reject(error) : resolve());
  }), { name: savedFile.name, bytes: backupBytes });
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 20_000 });
  await page.waitForFunction(() => window.__oj?.ready === true, null, { timeout: 20_000 });
  await page.waitForTimeout(2_000);
  const importedBytes = await page.evaluate((name) =>
    Array.from(window.Module.FS.readFile(`/persistent/${name}`)), savedFile.name);
  if (createHash('sha256').update(Buffer.from(importedBytes)).digest('hex') !== backupHash)
    throw new Error('Imported saved game differs from exported backup');
  await page.locator('canvas').focus();
  await page.keyboard.press('a');
  await page.waitForTimeout(2_000);
  await page.keyboard.press('g');
  await page.waitForTimeout(2_000);
  const importedTick = gameTicks(await readState());
  console.log('After backup import and Archive Go:', importedTick);
  const importedYear = Number(importedTick?.match(/year (\d+)/)?.[1]);
  const importedRails = Number(importedTick?.match(/rails (\d+)/)?.[1]);
  if (!Number.isFinite(importedYear) || !Number.isFinite(importedRails) ||
      importedYear < savedYear || importedRails < savedRails)
    throw new Error('Imported backup did not restore gameplay state');
  if (pageErrors.length || remoteRequests.length)
    throw new Error('Private browser encountered an error during backup round trip');
  // Attempt a player-built branch from the opening line to the third station.
  // These are real mouse actions before the trace-only time jump, so failures
  // reveal geometry or construction restrictions rather than faking a route.
  const mouseState = () => page.evaluate(() => {
    const packed = window.Module._oj_trace_mouse_state();
    return { construction: Boolean((packed >>> 24) & 1),
      tileX: (packed >>> 16) & 255, tileY: (packed >>> 8) & 255,
      type: packed & 255 };
  });
  let cursor = await mouseState();
  console.log('Third-station initial cursor state:', cursor);
  if (!cursor.construction) {
    await page.locator('canvas').focus();
    await page.keyboard.press('Space');
    await page.waitForTimeout(1_000);
    cursor = await mouseState();
    console.log('Third-station cursor after Space:', cursor);
  }
  if (!cursor.construction)
    throw new Error('Third-station branch test could not enter construction mode');
  let branchRails = Number(importedTick?.match(/rails (\d+)/)?.[1]);
  for (const { tile, x, y, type } of [
    { tile: '4,1', x: 584, y: 120, type: 2 },
    { tile: '5,2', x: 584, y: 178, type: 4 },
  ]) {
    await page.mouse.move(x, y);
    await page.mouse.click(x, y, { button: 'left' });
    await page.waitForTimeout(300);
    cursor = await mouseState();
    if (`${cursor.tileX},${cursor.tileY}` !== tile)
      throw new Error(`Branch pointer selected ${cursor.tileX},${cursor.tileY} instead of ${tile}`);
    for (let attempt = 0; cursor.type !== type && attempt < 6; ++attempt) {
      await page.mouse.click(x, y, { button: 'left' });
      await page.waitForTimeout(100);
      cursor = await mouseState();
    }
    if (cursor.type !== type)
      throw new Error(`Branch cursor could not select rail type ${type} at ${tile}`);
    await page.mouse.click(x, y, { button: 'right' });
    let placed = false;
    for (let attempt = 0; attempt < 8; ++attempt) {
      await page.waitForTimeout(1_000);
      const state = await readState();
      const count = Number(gameTicks(state)?.match(/rails (\d+)/)?.[1]);
      if (count > branchRails && state.stderr.some((line) =>
        line.startsWith(`OJ build queued tile ${tile}`))) {
        branchRails = count;
        placed = true;
        break;
      }
      if (state.abort || pageErrors.length || remoteRequests.length)
        throw new Error(`Private player failed while building third-station branch at ${tile}: ${JSON.stringify({
          abort: state.abort, pageErrors, remoteRequests,
          recentEngine: state.stderr.slice(-8),
        })}`);
    }
    console.log('Third-station branch placement:', tile, { placed, branchRails, cursor,
      recentBuild: (await readState()).stderr.filter((line) => line.startsWith('OJ build')).slice(-4) });
    if (!placed) throw new Error(`Player could not build third-station branch at ${tile}`);
  }
  // Private route diagnostic: stop random dispatch, let existing trains clear
  // on the original alignment, then send one controlled service to station 3.
  await page.evaluate(() => {
    if (typeof window.Module._oj_trace_pause_dispatch !== 'function')
      throw new Error('Private dispatch-pause probe is missing');
    window.Module._oj_trace_pause_dispatch(1);
  });
  let clearedTraffic = false;
  for (let attempt = 0; attempt < 105; ++attempt) {
    const active = await page.evaluate(() => window.Module._oj_trace_active_train_count());
    if (active === 0) { clearedTraffic = true; break; }
    await page.waitForTimeout(1_000);
  }
  if (!clearedTraffic)
    throw new Error('Existing two-station trains did not clear before the targeted route probe');
  // The newly built path begins disabled at a player-operated switch. Use
  // ordinary management-mode input to select it before testing service.
  const branchSwitchState = () => page.evaluate(() => {
    if (typeof window.Module._oj_trace_branch_switch_state !== 'function')
      throw new Error('Private branch-switch probe is missing');
    const raw = window.Module._oj_trace_branch_switch_state();
    if (raw < 0) return null;
    return { x: (raw >>> 12) & 4095, y: raw & 4095, enabled: Boolean(raw >>> 24) };
  });
  let branchSwitch = await branchSwitchState();
  if (!branchSwitch) throw new Error('Player-built third-station branch has no switch');
  await page.locator('canvas').focus();
  for (let attempt = 0; (await mouseState()).construction && attempt < 5; ++attempt) {
    await page.keyboard.press('Space');
    await page.waitForTimeout(1_000);
    console.log('Switch management mode attempt:', attempt + 1, await mouseState());
  }
  if ((await mouseState()).construction)
    throw new Error('Third-station test could not enter switch management mode');
  for (let attempt = 0; !branchSwitch.enabled && attempt < 60; ++attempt) {
    await page.mouse.click(branchSwitch.x, Math.round(branchSwitch.y * 480 / 350));
    await page.waitForTimeout(1_000);
    branchSwitch = await branchSwitchState();
    if (!branchSwitch) throw new Error('Branch switch disappeared after player click');
    const state = await readState();
    if (state.abort || pageErrors.length || remoteRequests.length)
      throw new Error('Private browser failed while toggling the branch switch');
  }
  console.log('Player-managed third-station switch:', branchSwitch);
  if (!branchSwitch.enabled)
    throw new Error('Player could not enable third-station branch switch');
  // Reach the third station's branch without pretending to play 35 years.
  await page.evaluate(() => {
    if (typeof window.Module._oj_trace_jump_to_1840 !== 'function')
      throw new Error('Private third-station hook is missing');
    window.Module._oj_trace_jump_to_1840();
  });
  let thirdStation;
  for (let attempt = 0; attempt < 15; ++attempt) {
    await page.waitForTimeout(1_000);
    thirdStation = await readState();
    if (Number(gameTicks(thirdStation)?.match(/entrances (\d+)/)?.[1]) >= 3) break;
  }
  if (!thirdStation.stderr.includes('OJ year-1840 branch prepared') ||
      Number(gameTicks(thirdStation)?.match(/entrances (\d+)/)?.[1]) < 3 ||
      thirdStation.abort || pageErrors.length || remoteRequests.length)
    throw new Error('Private third-station branch did not add an entrance');
  // Let the entrance animation and queued redraw settle before visual review.
  await page.waitForTimeout(3_000);
  thirdStation = await readState();
  console.log('After third-station redraw:', gameTicks(thirdStation));
  if (thirdStation.abort || pageErrors.length || remoteRequests.length)
    throw new Error('Private browser failed after the third-station redraw');
  const thirdImage = await page.locator('canvas').screenshot({ timeout: 5_000 });
  console.log('Private third-station canvas PNG SHA-256:',
    createHash('sha256').update(thirdImage).digest('hex'));
  const gridPixels = await page.evaluate(async (pngBase64) => {
    const image = new Image();
    image.src = `data:image/png;base64,${pngBase64}`;
    await image.decode();
    const scratch = document.createElement('canvas');
    scratch.width = image.width;
    scratch.height = image.height;
    const context = scratch.getContext('2d');
    context.drawImage(image, 0, 0);
    return [220, 300].flatMap((y) => [32, 64, 96, 128].map((x) =>
      [...context.getImageData(x, y, 1, 1).data].slice(0, 3)));
  }, thirdImage.toString('base64'));
  const preservedGrid = gridPixels.filter((rgb) =>
    rgb[0] === 129 && rgb[1] === 160 && rgb[2] === 190).length;
  console.log('Third-station independent grid samples:', preservedGrid, 'of', gridPixels.length);
  if (preservedGrid < 5)
    throw new Error('The independent board grid disappeared after world redraw');
  if (process.env.OPEN_JUNCTION_THIRD_SCREENSHOT)
    await writeFile(process.env.OPEN_JUNCTION_THIRD_SCREENSHOT, thirdImage);
  await page.locator('canvas').focus();
  await page.keyboard.press('1');
  const targetedSlot = await page.evaluate(() => {
    if (typeof window.Module._oj_trace_spawn_third_service !== 'function')
      throw new Error('Private targeted-service probe is missing');
    return window.Module._oj_trace_spawn_third_service();
  });
  console.log('Private targeted third-station service slot:', targetedSlot);
  if (targetedSlot < 0)
    throw new Error('Private test could not dispatch an isolated third-station service');
  let thirdStationDelivery = false;
  for (let attempt = 0; attempt < 30; ++attempt) {
    await page.waitForTimeout(5_000);
    const state = await readState();
    const activeSlots = new Map();
    for (const line of state.stderr) {
      const spawned = line.match(/^OJ train spawned from (\d+) to (\d+) at year \d+ slot (\d+)$/);
      if (spawned) activeSlots.set(spawned[3], { from: Number(spawned[1]), to: Number(spawned[2]) });
      const completed = line.match(/^OJ train completed slot (\d+) dst (\d+) arrived ([01])$/);
      if (completed) {
        const service = activeSlots.get(completed[1]);
        if (service && (service.from === 2 || service.to === 2) &&
            Number(completed[2]) === service.to && completed[3] === '1')
          thirdStationDelivery = true;
        activeSlots.delete(completed[1]);
      }
    }
    console.log('Third-station delivery probe:', {
      seconds: (attempt + 1) * 5, activeSlots: [...activeSlots],
      completedThirdStationService: thirdStationDelivery, latestTick: gameTicks(state),
      branchSwitch: await branchSwitchState(),
      trainHeads: state.stderr.filter((line) => line.startsWith('OJ active train slot ')).slice(-5),
      abort: state.abort, pageErrors, remoteRequests,
    });
    if (state.abort || pageErrors.length || remoteRequests.length)
      throw new Error('Private browser failed during third-station delivery probe');
    if (thirdStationDelivery) break;
  }
  if (!thirdStationDelivery)
    throw new Error('No train completed a service involving the third station after player-built extension');
  // Diagnose the other third-station pair separately. The starter switch must
  // first let station 0's train leave; setting it toward station 2 too early
  // traps the train at its origin. This trace-forced trip probes route geometry,
  // never counts as naturally scheduled gameplay.
  await page.mouse.click(branchSwitch.x, Math.round(branchSwitch.y * 480 / 350));
  await page.waitForTimeout(1_000);
  branchSwitch = await branchSwitchState();
  if (!branchSwitch || branchSwitch.enabled)
    throw new Error('Player could not align the branch for cross-route diagnosis');
  const crossStart = (await readState()).stderr.length;
  const crossSlot = await page.evaluate(() => {
    if (typeof window.Module._oj_trace_spawn_cross_branch_service !== 'function')
      throw new Error('Private cross-branch service hook is missing');
    return window.Module._oj_trace_spawn_cross_branch_service();
  });
  if (crossSlot < 0)
    throw new Error(`Private cross-branch service could not start: ${crossSlot}`);
  let crossDelivered = false;
  let departedOrigin = false;
  let crossImageCaptured = false;
  const crossSwitchAttempts = [];
  for (let attempt = 0; attempt < 56; ++attempt) {
    await page.waitForTimeout(5_000);
    const state = await readState();
    const lines = state.stderr.slice(crossStart);
    const heads = lines.filter((line) => line.startsWith(`OJ active train slot ${crossSlot} `));
    const latestHead = heads.at(-1);
    const headX = Number(latestHead?.match(/head (\d+),/)?.[1]);
    if (Number.isFinite(headX) && headX < 550) departedOrigin = true;
    if (departedOrigin && !(await branchSwitchState())?.enabled) {
      const before = await branchSwitchState();
      await page.mouse.click(before.x, Math.round(before.y * 480 / 350));
      await page.waitForTimeout(1_000);
      crossSwitchAttempts.push({ seconds: (attempt + 1) * 5, head: latestHead,
        before, after: await branchSwitchState() });
    }
    if (!crossImageCaptured && (await branchSwitchState())?.enabled &&
        process.env.OPEN_JUNCTION_CROSS_SCREENSHOT) {
      await writeFile(process.env.OPEN_JUNCTION_CROSS_SCREENSHOT,
        await page.locator('canvas').screenshot({ timeout: 5_000 }));
      crossImageCaptured = true;
    }
    crossDelivered = lines.some((line) =>
      line === `OJ train completed slot ${crossSlot} dst 2 arrived 1`);
    if (state.abort || pageErrors.length || remoteRequests.length)
      throw new Error('Private browser failed during cross-branch diagnostic');
    if (crossDelivered || lines.some((line) =>
      line.startsWith(`OJ train completed slot ${crossSlot} `))) break;
  }
  console.log('Trace-forced 0-to-2 route diagnostic:', JSON.stringify({
    crossSlot, departedOrigin, crossDelivered, crossSwitchAttempts,
    branchSwitch: await branchSwitchState(),
    trainHeads: (await readState()).stderr.slice(crossStart).filter((line) =>
      line.startsWith(`OJ active train slot ${crossSlot} `)).slice(-15),
  }));
  if (!crossDelivered)
    throw new Error('Player-managed cross-branch route did not complete a 0-to-2 service');
  if (process.env.OPEN_JUNCTION_CROSS_SCREENSHOT)
    await writeFile(process.env.OPEN_JUNCTION_CROSS_SCREENSHOT.replace('.png', '-arrived.png'),
      await page.locator('canvas').screenshot({ timeout: 5_000 }));
  // Restore the original route through ordinary player input before letting
  // the scheduler run again. The fixed branch alignment blocked mixed traffic
  // in run 35966071614. Move the junction for the oldest pending service when
  // it is safe to do so; these are real management-mode mouse clicks.
  if ((await branchSwitchState())?.enabled) {
    await page.mouse.click(branchSwitch.x, Math.round(branchSwitch.y * 480 / 350));
    await page.waitForTimeout(1_000);
  }
  branchSwitch = await branchSwitchState();
  if (!branchSwitch || branchSwitch.enabled)
    throw new Error('Player could not restore the original route before natural dispatch');
  const organicStart = (await readState()).stderr.length;
  // Accelerate ordinary player-controlled game time to sample more than one
  // scheduler decision in this bounded CI observation window.
  await page.keyboard.press('3');
  await page.evaluate(() => window.Module._oj_trace_pause_dispatch(0));
  let organicThirdDelivery = false;
  let organicSpawns = [];
  let organicCompletions = [];
  const organicSwitchAttempts = [];
  let organicSeconds = 0;
  let maxSimultaneousServices = 0;
  let organicFourthService = null;
  for (let attempt = 0; attempt < 96; ++attempt) {
    await page.waitForTimeout(5_000);
    organicSeconds += 5;
    const state = await readState();
    const services = new Map();
    organicSpawns = [];
    organicCompletions = [];
    for (const line of state.stderr.slice(organicStart)) {
      const spawned = line.match(/^OJ train spawned from (\d+) to (\d+) at year \d+ slot (\d+)$/);
      if (spawned) {
        const service = { from: Number(spawned[1]), to: Number(spawned[2]), slot: Number(spawned[3]) };
        services.set(service.slot, service);
        maxSimultaneousServices = Math.max(maxSimultaneousServices, services.size);
        organicSpawns.push(service);
      }
      const completed = line.match(/^OJ train completed slot (\d+) dst (\d+) arrived ([01])$/);
      if (completed) {
        const service = services.get(Number(completed[1]));
        if (service) {
          const outcome = { ...service, destination: Number(completed[2]), arrived: completed[3] === '1' };
          organicCompletions.push(outcome);
          if ((outcome.from === 2 || outcome.to === 2) && outcome.destination === outcome.to && outcome.arrived)
            organicThirdDelivery = true;
          services.delete(service.slot);
        }
      }
    }
    const oldestPendingService = [...services.values()][0];
    const latestHead = oldestPendingService && [...state.stderr.slice(organicStart)].reverse()
      .find(line => line.startsWith(`OJ active train slot ${oldestPendingService.slot} `));
    const headX = Number(latestHead?.match(/head (\d+),/)?.[1]);
    const departedOrigin = Number.isFinite(headX) && headX < 550;
    const desiredBranch = oldestPendingService && (
      oldestPendingService.from === 0 && oldestPendingService.to === 2 ? departedOrigin :
      oldestPendingService.from === 2 && oldestPendingService.to === 0 ? !departedOrigin :
      oldestPendingService.from === 2 || oldestPendingService.to === 2
    );
    const beforeSwitch = await branchSwitchState();
    if (oldestPendingService && beforeSwitch?.enabled !== desiredBranch) {
      await page.mouse.click(beforeSwitch.x, Math.round(beforeSwitch.y * 480 / 350));
      await page.waitForTimeout(1_000);
      const afterSwitch = await branchSwitchState();
      organicSwitchAttempts.push({ seconds: organicSeconds, service: oldestPendingService,
        head: latestHead, desiredBranch, before: beforeSwitch, after: afterSwitch });
    }
    if (state.abort || pageErrors.length || remoteRequests.length)
      throw new Error('Private browser failed during natural-dispatch observation');
    // Continue after the first third-station arrival. A single successful trip
    // does not show that queued return and later cross-branch services remain
    // playable on this shared line.
    // Later construction needs a live fourth-station assignment while the
    // train is still approaching its junction. Waiting for a fixed four-minute
    // cutoff can let the assigned train pass that junction before rails exist.
    if (organicCompletions.length >= 2 && oldestPendingService &&
        (oldestPendingService.from === 3 || oldestPendingService.to === 3)) {
      organicFourthService = oldestPendingService;
      break;
    }
  }
  console.log('Natural-dispatch observation:', JSON.stringify({
    secondsObserved: organicSeconds, organicThirdDelivery, organicSpawns, organicCompletions,
    organicSwitchAttempts, maxSimultaneousServices,
    waitingServices: await page.evaluate(() => window.Module._oj_trace_waiting_train_count()),
    branchSwitch: await branchSwitchState(), latestTick: gameTicks(await readState()),
    trainHeads: (await readState()).stderr.slice(organicStart).filter((line) =>
      line.startsWith('OJ active train slot ')).slice(-12),
  }));
  if (maxSimultaneousServices > 1)
    throw new Error('The independent single-track network dispatched overlapping services');
  if (!organicThirdDelivery)
    throw new Error('Ordinary dispatch did not complete a third-station delivery');
  if (organicCompletions.length < 2)
    throw new Error('Ordinary dispatch did not complete a second serialized service');
  if (!organicFourthService)
    throw new Error('Ordinary dispatch did not assign a fourth-station service within eight minutes');
  await page.evaluate(() => window.Module._oj_trace_pause_dispatch(1));
  const lateGameState = await readState();
  if (Number(gameTicks(lateGameState)?.match(/entrances (\d+)/)?.[1]) < 4)
    throw new Error('Fourth station did not appear during ordinary progression');
  // A graph search over the pinned connection table found this two-rail
  // extension toward the automatically added fourth station. Construction is
  // tested through actual player input; connectivity and delivery are separate
  // gates and are not inferred from these placement assertions.
  await page.locator('canvas').focus();
  if (!(await mouseState()).construction) {
    await page.keyboard.press('Space');
    await page.waitForTimeout(1_000);
  }
  if (!(await mouseState()).construction)
    throw new Error('Player could not enter construction mode for station four');
  let fourthRouteRails = Number(gameTicks(lateGameState)?.match(/rails (\d+)/)?.[1]);
  for (const { tile, x, y, type } of [
    { tile: '1,4', x: 56, y: 120, type: 4 },
    { tile: '2,5', x: 56, y: 178, type: 2 },
  ]) {
    await page.mouse.move(x, y);
    await page.mouse.click(x, y, { button: 'left' });
    await page.waitForTimeout(300);
    let selected = await mouseState();
    if (`${selected.tileX},${selected.tileY}` !== tile)
      throw new Error(`Fourth-station pointer selected ${selected.tileX},${selected.tileY} instead of ${tile}`);
    for (let attempt = 0; selected.type !== type && attempt < 6; ++attempt) {
      await page.mouse.click(x, y, { button: 'left' });
      await page.waitForTimeout(100);
      selected = await mouseState();
    }
    if (selected.type !== type)
      throw new Error(`Fourth-station cursor could not select rail type ${type} at ${tile}`);
    await page.mouse.click(x, y, { button: 'right' });
    let placed = false;
    for (let attempt = 0; attempt < 8; ++attempt) {
      await page.waitForTimeout(1_000);
      const state = await readState();
      const count = Number(gameTicks(state)?.match(/rails (\d+)/)?.[1]);
      if (count > fourthRouteRails && state.stderr.some((line) =>
        line.startsWith(`OJ build queued tile ${tile}`))) {
        fourthRouteRails = count;
        placed = true;
        break;
      }
      if (state.abort || pageErrors.length || remoteRequests.length)
        throw new Error(`Private browser failed during fourth-station construction at ${tile}`);
    }
    console.log('Fourth-station candidate rail:', JSON.stringify({ tile, type, placed, fourthRouteRails }));
    if (!placed)
      throw new Error(`Player could not construct fourth-station candidate rail at ${tile}`);
  }
  const fourthSwitchState = () => page.evaluate(() => {
    const raw = window.Module._oj_trace_fourth_switch_state();
    if (raw < 0) return null;
    return { x: (raw >>> 12) & 4095, y: raw & 4095, enabled: Boolean(raw >>> 24) };
  });
  await page.locator('canvas').focus();
  if ((await mouseState()).construction) {
    await page.keyboard.press('Space');
    await page.waitForTimeout(1_000);
  }
  if ((await mouseState()).construction)
    throw new Error('Player could not return to management mode after station-four construction');
  let fourthSwitch = await fourthSwitchState();
  const fourthSwitchAttempts = [];
  for (let attempt = 0; fourthSwitch && !fourthSwitch.enabled && attempt < 8; ++attempt) {
    await page.mouse.click(fourthSwitch.x, Math.round(fourthSwitch.y * 480 / 350));
    await page.waitForTimeout(1_000);
    const after = await fourthSwitchState();
    fourthSwitchAttempts.push({ before: fourthSwitch, after });
    fourthSwitch = after;
  }
  if (!fourthSwitch?.enabled)
    throw new Error('Player could not enable the fourth-station branch switch');
  const fourthStart = (await readState()).stderr.length;
  const fourthActiveService = organicFourthService;
  let fourthArrival = false;
  let fourthDepartedOrigin = false;
  const fourthReturnSwitchAttempts = [];
  for (let attempt = 0; attempt < 54; ++attempt) {
    await page.waitForTimeout(5_000);
    const state = await readState();
    const headLine = [...state.stderr.slice(fourthStart)].reverse().find(line =>
      line.startsWith(`OJ active train slot ${fourthActiveService.slot} `));
    const headX = Number(headLine?.match(/head (-?\d+),/)?.[1]);
    if (fourthActiveService.from === 3 && Number.isFinite(headX) && headX > 100)
      fourthDepartedOrigin = true;
    if (fourthDepartedOrigin && fourthActiveService.to !== 3) {
      const before = await fourthSwitchState();
      if (before?.enabled) {
        await page.mouse.click(before.x, Math.round(before.y * 480 / 350));
        await page.waitForTimeout(1_000);
        fourthReturnSwitchAttempts.push({ headLine, before, after: await fourthSwitchState() });
      }
    }
    fourthArrival = fourthArrival || Boolean(fourthActiveService &&
      (fourthActiveService.from === 3 || fourthActiveService.to === 3) &&
      state.stderr.slice(fourthStart).includes(
        `OJ train completed slot ${fourthActiveService.slot} dst ${fourthActiveService.to} arrived 1`));
    if (state.abort || pageErrors.length || remoteRequests.length)
      throw new Error('Private browser failed while observing the fourth-station extension');
    if (fourthArrival) break;
  }
  console.log('Fourth-station route diagnostic:', JSON.stringify({
    fourthActiveService, fourthSwitch, fourthSwitchAttempts,
    fourthDepartedOrigin, fourthReturnSwitchAttempts, fourthArrival,
    latestTick: gameTicks(await readState()),
    recentEngine: (await readState()).stderr.slice(fourthStart).filter((line) =>
      line.startsWith('OJ train completed') || line.startsWith('OJ active train slot ')).slice(-18),
  }));
  if (!fourthArrival)
    throw new Error('Player-connected fourth-station service did not arrive');
  const fourthImage = await page.locator('canvas').screenshot({ timeout: 5_000 });
  if (process.env.OPEN_JUNCTION_FOURTH_SCREENSHOT)
    await writeFile(process.env.OPEN_JUNCTION_FOURTH_SCREENSHOT, fourthImage);
  console.log('Private fourth-station canvas PNG SHA-256:',
    createHash('sha256').update(fourthImage).digest('hex'));
  // Explore the next proposed extension separately. This trace-only year jump
  // and forced service test geometry; they do not prove natural fifth-station
  // dispatch or continuous play through the skipped years.
  await page.evaluate(() => {
    if (typeof window.Module._oj_trace_jump_to_1920 !== 'function')
      throw new Error('Private fifth-station year hook is missing');
    window.Module._oj_trace_jump_to_1920();
  });
  let fifthStation;
  for (let attempt = 0; attempt < 15; ++attempt) {
    await page.waitForTimeout(1_000);
    fifthStation = await readState();
    if (Number(gameTicks(fifthStation)?.match(/entrances (\d+)/)?.[1]) >= 5) break;
  }
  if (Number(gameTicks(fifthStation)?.match(/entrances (\d+)/)?.[1]) < 5 ||
      fifthStation.abort || pageErrors.length || remoteRequests.length)
    throw new Error('Private fifth-station branch did not add an entrance');
  await page.locator('canvas').focus();
  if (!(await mouseState()).construction) {
    await page.keyboard.press('Space');
    await page.waitForTimeout(1_000);
  }
  if (!(await mouseState()).construction)
    throw new Error('Player could not enter construction mode for station five');
  let fifthRouteRails = Number(gameTicks(fifthStation)?.match(/rails (\d+)/)?.[1]);
  for (const { tile, x, y, type } of [
    // Click inside each projected diamond, not exactly on its upper boundary.
    { tile: '6,3', x: 584, y: 235, type: 2 },
    { tile: '7,4', x: 584, y: 293, type: 4 },
  ]) {
    await page.mouse.move(x, y);
    await page.mouse.click(x, y, { button: 'left' });
    await page.waitForTimeout(300);
    let selected = await mouseState();
    if (`${selected.tileX},${selected.tileY}` !== tile)
      throw new Error(`Fifth-station pointer selected ${selected.tileX},${selected.tileY} instead of ${tile}`);
    for (let attempt = 0; selected.type !== type && attempt < 6; ++attempt) {
      await page.mouse.click(x, y, { button: 'left' });
      await page.waitForTimeout(100);
      selected = await mouseState();
    }
    if (selected.type !== type)
      throw new Error(`Fifth-station cursor could not select rail type ${type} at ${tile}`);
    await page.mouse.click(x, y, { button: 'right' });
    let placed = false;
    for (let attempt = 0; attempt < 8; ++attempt) {
      await page.waitForTimeout(1_000);
      const state = await readState();
      const count = Number(gameTicks(state)?.match(/rails (\d+)/)?.[1]);
      if (count > fifthRouteRails && state.stderr.some((line) =>
        line.startsWith(`OJ build queued tile ${tile}`))) {
        fifthRouteRails = count;
        placed = true;
        break;
      }
      if (state.abort || pageErrors.length || remoteRequests.length)
        throw new Error(`Private browser failed during fifth-station construction at ${tile}`);
    }
    console.log('Fifth-station candidate rail:', JSON.stringify({ tile, type, placed, fifthRouteRails }));
    if (!placed)
      throw new Error(`Player could not construct fifth-station candidate rail at ${tile}`);
  }
  await page.locator('canvas').focus();
  if ((await mouseState()).construction) {
    await page.keyboard.press('Space');
    await page.waitForTimeout(1_000);
  }
  if ((await mouseState()).construction)
    throw new Error('Player could not return to management mode after station-five construction');
  const fifthSwitchState = () => page.evaluate(() => {
    const raw = window.Module._oj_trace_fifth_switch_state();
    if (raw < 0) return null;
    return { x: (raw >>> 12) & 4095, y: raw & 4095, enabled: Boolean(raw >>> 24) };
  });
  let fifthSwitch = await fifthSwitchState();
  if (!fifthSwitch)
    throw new Error('Player-built fifth-station branch has no switch');
  if (!fifthSwitch.enabled) {
    await page.mouse.click(fifthSwitch.x, Math.round(fifthSwitch.y * 480 / 350));
    await page.waitForTimeout(1_000);
    fifthSwitch = await fifthSwitchState();
  }
  let towardThird = await branchSwitchState();
  if (towardThird && !towardThird.enabled) {
    await page.mouse.click(towardThird.x, Math.round(towardThird.y * 480 / 350));
    await page.waitForTimeout(1_000);
    towardThird = await branchSwitchState();
  }
  if (!fifthSwitch?.enabled || !towardThird?.enabled)
    throw new Error('Player could not enable the route to station five');
  const fifthSlot = await page.evaluate(() => window.Module._oj_trace_spawn_fifth_service());
  if (fifthSlot < 0)
    throw new Error(`Private test could not dispatch isolated fifth-station service: ${fifthSlot}`);
  const fifthStart = (await readState()).stderr.length;
  let fifthArrival = false;
  for (let attempt = 0; attempt < 36; ++attempt) {
    await page.waitForTimeout(5_000);
    const state = await readState();
    fifthArrival = fifthArrival || state.stderr.slice(fifthStart).includes(
      `OJ train completed slot ${fifthSlot} dst 4 arrived 1`);
    if (state.abort || pageErrors.length || remoteRequests.length)
      throw new Error('Private browser failed while observing the fifth-station extension');
    if (fifthArrival) break;
  }
  console.log('Fifth-station route diagnostic:', JSON.stringify({
    fifthSlot, fifthSwitch, towardThird, fifthArrival,
    latestTick: gameTicks(await readState()),
    recentEngine: (await readState()).stderr.slice(fifthStart).filter((line) =>
      line.startsWith('OJ train completed') || line.startsWith('OJ active train slot ')).slice(-18),
  }));
  if (!fifthArrival)
    throw new Error('Player-connected fifth-station trace service did not arrive');
  // The sixth station is reached by another private year jump. This probes
  // player-buildable geometry and one isolated train only, not natural service.
  await page.evaluate(() => window.Module._oj_trace_jump_to_1960());
  let sixthStation;
  for (let attempt = 0; attempt < 15; ++attempt) {
    await page.waitForTimeout(1_000);
    sixthStation = await readState();
    if (Number(gameTicks(sixthStation)?.match(/entrances (\d+)/)?.[1]) >= 6) break;
  }
  if (Number(gameTicks(sixthStation)?.match(/entrances (\d+)/)?.[1]) < 6 ||
      sixthStation.abort || pageErrors.length || remoteRequests.length)
    throw new Error('Private sixth-station branch did not add an entrance');
  await page.locator('canvas').focus();
  if (!(await mouseState()).construction) {
    await page.keyboard.press('Space');
    await page.waitForTimeout(1_000);
  }
  if (!(await mouseState()).construction)
    throw new Error('Player could not enter construction mode for station six');
  let sixthRouteRails = Number(gameTicks(sixthStation)?.match(/rails (\d+)/)?.[1]);
  for (const { tile, x, y, type } of [
    { tile: '3,6', x: 56, y: 235, type: 4 },
    { tile: '4,7', x: 56, y: 293, type: 2 },
  ]) {
    await page.mouse.move(x, y);
    await page.mouse.click(x, y, { button: 'left' });
    await page.waitForTimeout(300);
    let selected = await mouseState();
    if (`${selected.tileX},${selected.tileY}` !== tile)
      throw new Error(`Sixth-station pointer selected ${selected.tileX},${selected.tileY} instead of ${tile}`);
    for (let attempt = 0; selected.type !== type && attempt < 6; ++attempt) {
      await page.mouse.click(x, y, { button: 'left' });
      await page.waitForTimeout(100);
      selected = await mouseState();
    }
    if (selected.type !== type)
      throw new Error(`Sixth-station cursor could not select rail type ${type} at ${tile}`);
    await page.mouse.click(x, y, { button: 'right' });
    let placed = false;
    for (let attempt = 0; attempt < 8; ++attempt) {
      await page.waitForTimeout(1_000);
      const state = await readState();
      const count = Number(gameTicks(state)?.match(/rails (\d+)/)?.[1]);
      if (count > sixthRouteRails && state.stderr.some((line) =>
        line.startsWith(`OJ build queued tile ${tile}`))) {
        sixthRouteRails = count;
        placed = true;
        break;
      }
      if (state.abort || pageErrors.length || remoteRequests.length)
        throw new Error(`Private browser failed during sixth-station construction at ${tile}`);
    }
    console.log('Sixth-station candidate rail:', JSON.stringify({ tile, type, placed, sixthRouteRails }));
    if (!placed)
      throw new Error(`Player could not construct sixth-station candidate rail at ${tile}`);
  }
  await page.locator('canvas').focus();
  if ((await mouseState()).construction) {
    await page.keyboard.press('Space');
    await page.waitForTimeout(1_000);
  }
  if ((await mouseState()).construction)
    throw new Error('Player could not return to management mode after station-six construction');
  const sixthSwitchState = () => page.evaluate(() => {
    const raw = window.Module._oj_trace_sixth_switch_state();
    if (raw < 0) return null;
    return { x: (raw >>> 12) & 4095, y: raw & 4095, enabled: Boolean(raw >>> 24) };
  });
  let sixthSwitch = await sixthSwitchState();
  if (!sixthSwitch)
    throw new Error('Player-built sixth-station branch has no switch');
  if (!sixthSwitch.enabled) {
    await page.mouse.click(sixthSwitch.x, Math.round(sixthSwitch.y * 480 / 350));
    await page.waitForTimeout(1_000);
    sixthSwitch = await sixthSwitchState();
  }
  if (!sixthSwitch?.enabled)
    throw new Error('Player could not enable the sixth-station branch');
  const sixthSlot = await page.evaluate(() => window.Module._oj_trace_spawn_sixth_service());
  if (sixthSlot < 0)
    throw new Error(`Private test could not dispatch isolated sixth-station service: ${sixthSlot}`);
  const sixthStart = (await readState()).stderr.length;
  let sixthArrival = false;
  for (let attempt = 0; attempt < 54; ++attempt) {
    await page.waitForTimeout(5_000);
    const state = await readState();
    sixthArrival = sixthArrival || state.stderr.slice(sixthStart).includes(
      `OJ train completed slot ${sixthSlot} dst 5 arrived 1`);
    if (state.abort || pageErrors.length || remoteRequests.length)
      throw new Error('Private browser failed while observing the sixth-station extension');
    if (sixthArrival) break;
  }
  console.log('Sixth-station route diagnostic:', JSON.stringify({
    sixthSlot, sixthSwitch, sixthArrival,
    latestTick: gameTicks(await readState()),
    recentEngine: (await readState()).stderr.slice(sixthStart).filter((line) =>
      line.startsWith('OJ train completed') || line.startsWith('OJ active train slot ')).slice(-18),
  }));
  if (!sixthArrival)
    throw new Error('Player-connected sixth-station trace service did not arrive');
  // Let the ordinary scheduler run at six stations. The test operates each
  // visible switch with mouse clicks according to the assigned service; no
  // destination is injected. Observe a completed late-station service, not
  // merely another trace-targeted route.
  const lateStart = (await readState()).stderr.length;
  await page.evaluate(() => window.Module._oj_trace_pause_dispatch(0));
  const lateSwitches = [branchSwitchState, fourthSwitchState, fifthSwitchState, sixthSwitchState];
  const lateSpawns = [];
  const lateCompletions = [];
  const lateSwitchClicks = [];
  let lateService = null;
  let lateDepartedOrigin = false;
  let lateArrival = false;
  let lateCursor = lateStart;
  for (let attempt = 0; attempt < 36; ++attempt) {
    await page.waitForTimeout(5_000);
    const state = await readState();
    for (const line of state.stderr.slice(lateCursor)) {
      const spawned = line.match(/^OJ train spawned from (\d+) to (\d+) at year \d+ slot (\d+)$/);
      if (spawned) {
        lateService = { from: Number(spawned[1]), to: Number(spawned[2]), slot: Number(spawned[3]) };
        lateDepartedOrigin = false;
        lateSpawns.push(lateService);
      }
      const completed = line.match(/^OJ train completed slot (\d+) dst (\d+) arrived ([01])$/);
      if (completed && lateService?.slot === Number(completed[1])) {
        const result = { ...lateService, arrived: completed[3] === '1', destination: Number(completed[2]) };
        lateCompletions.push(result);
        if (result.arrived && result.destination === result.to &&
            (result.from >= 4 || result.to >= 4)) lateArrival = true;
        lateService = null;
      }
    }
    lateCursor = state.stderr.length;
    if (state.abort || pageErrors.length || remoteRequests.length)
      throw new Error('Private browser failed during natural six-station traffic');
    if (lateArrival) break;
    if (!lateService) continue;
    const activeLine = [...state.stderr].reverse().find(line =>
      line.startsWith(`OJ active train slot ${lateService.slot} `));
    const headX = Number(activeLine?.match(/head (-?\d+),/)?.[1]);
    const fromRight = lateService.from % 2 === 0;
    const fromLeft = !fromRight;
    if (Number.isFinite(headX) &&
        (fromRight && headX < 550 || fromLeft && headX > 100))
      lateDepartedOrigin = true;
    const rightTop = fromRight && !lateDepartedOrigin ? lateService.from >= 2 :
      lateService.to === 2 || lateService.to === 4;
    const rightBottom = fromRight && !lateDepartedOrigin ? lateService.from === 4 :
      lateService.to === 4;
    const leftTop = fromLeft && !lateDepartedOrigin ? lateService.from >= 3 :
      lateService.to === 3 || lateService.to === 5;
    const leftBottom = fromLeft && !lateDepartedOrigin ? lateService.from === 5 :
      lateService.to === 5;
    const desired = [rightTop, leftTop, rightBottom, leftBottom];
    for (let index = 0; index < lateSwitches.length; ++index) {
      let before = await lateSwitches[index]();
      if (!before || before.enabled === desired[index]) continue;
      for (let click = 0; click < 3; ++click) {
        await page.mouse.click(before.x, Math.round(before.y * 480 / 350));
        await page.waitForTimeout(1_200);
        const after = await lateSwitches[index]();
        lateSwitchClicks.push({ service: lateService, index, headX, before, after, click });
        if (after?.enabled === desired[index]) break;
        // A train may temporarily occupy the junction. Let the next sampled
        // tick retry rather than calling a refused click a browser failure.
        before = after;
        if (!before) break;
      }
    }
  }
  console.log('Natural six-station observation:', JSON.stringify({
    lateSpawns, lateCompletions, lateArrival, lateSwitchClicks, lateDepartedOrigin,
    waitingServices: await page.evaluate(() => window.Module._oj_trace_waiting_train_count()),
    latestTick: gameTicks(await readState()),
    trainHeads: (await readState()).stderr.slice(lateStart).filter(line =>
      line.startsWith('OJ active train slot ')).slice(-30),
  }));
  if (!lateArrival)
    throw new Error('Ordinary six-station dispatch did not complete a late-station journey');
  await page.evaluate(() => window.Module._oj_trace_pause_dispatch(1));
  // Exercise the otherwise slow year-2000 branch with a trace-only jump.
  // This proves the transition code path, not 200 years of continuous play.
  await page.evaluate(() => {
    if (typeof window.Module._oj_trace_jump_to_2000 !== 'function')
      throw new Error('Private transition hook is missing');
    window.Module._oj_trace_jump_to_2000();
  });
  let transition;
  for (let attempt = 0; attempt < 15; ++attempt) {
    await page.waitForTimeout(1_000);
    transition = await readState();
    if (transition.stderr.includes('OJ level transition alert')) break;
  }
  if (!transition.stderr.includes('OJ level transition entered') ||
      !transition.stderr.includes('OJ level transition alert'))
    throw new Error('Private year-2000 transition did not reach its alert');
  await page.keyboard.press('Space'); // Dismiss the in-game transition alert.
  for (let attempt = 0; attempt < 8; ++attempt) {
    await page.waitForTimeout(1_000);
    transition = await readState();
    if (transition.stderr.some(line => /OJ level transition completed level \d+ year 1800/.test(line))) break;
  }
  console.log('Private level-transition trace:', transition.stderr.filter(line =>
    line.startsWith('OJ level transition')).slice(-3));
  if (!transition.stderr.some(line => /OJ level transition completed level \d+ year 1800/.test(line)) ||
      transition.abort || pageErrors.length || remoteRequests.length)
    throw new Error('Private year-2000 transition did not reset the year and advance the level');
  // Force the loss condition only in the private trace build. This tests the
  // branch and replacement game-over art, not organic campaign failure.
  await page.evaluate(() => {
    if (typeof window.Module._oj_trace_insolvent !== 'function')
      throw new Error('Private game-over hook is missing');
    window.Module._oj_trace_insolvent();
  });
  let gameOver;
  for (let attempt = 0; attempt < 15; ++attempt) {
    await page.waitForTimeout(1_000);
    gameOver = await readState();
    if (gameOver.stderr.includes('OJ game over entered')) break;
  }
  if (!gameOver.stderr.includes('OJ game-over branch prepared') ||
      !gameOver.stderr.includes('OJ game over entered') ||
      gameOver.stderr.some(line => line.includes("unable to read file 'GAMEOVER.7'")) ||
      gameOver.abort || pageErrors.length || remoteRequests.length)
    throw new Error('Private game-over branch did not display its replacement art');
} finally {
  await browser?.close();
  await new Promise((done) => server.close(done));
}
