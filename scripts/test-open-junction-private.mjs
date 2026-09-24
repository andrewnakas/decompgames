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
    if (Number(tick?.match(/year (\d+)/)?.[1]) >= 1805) break;
  }
  const loadedTick = gameTicks(loaded);
  if (Number(loadedTick?.match(/year (\d+)/)?.[1]) < 1805 ||
      Number(loadedTick?.match(/rails (\d+)/)?.[1]) < 5)
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
  if (Number(importedTick?.match(/year (\d+)/)?.[1]) < 1805 ||
      Number(importedTick?.match(/rails (\d+)/)?.[1]) < 5)
    throw new Error('Imported backup did not restore gameplay state');
  if (pageErrors.length || remoteRequests.length)
    throw new Error('Private browser encountered an error during backup round trip');
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
  // Attempt a player-built branch from the opening line to the third station.
  // These are real mouse actions after the trace-only time jump, so failures
  // reveal geometry or construction restrictions rather than faking a route.
  let branchRails = Number(gameTicks(thirdStation)?.match(/rails (\d+)/)?.[1]);
  for (const { tile, x, y, type } of [
    { tile: '4,1', x: 584, y: 183, type: 2 },
    { tile: '5,2', x: 584, y: 225, type: 1 },
  ]) {
    await page.mouse.move(x, y);
    await page.mouse.click(x, y, { button: 'left' });
    for (let nextType = 0; nextType < type; ++nextType)
      await page.mouse.click(x, y, { button: 'left' });
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
        throw new Error(`Private player failed while building third-station branch at ${tile}`);
    }
    console.log('Third-station branch placement:', tile, { placed, branchRails });
    if (!placed) throw new Error(`Player could not build third-station branch at ${tile}`);
  }
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
