// Player for clean-room builds, which are hosted in their own repositories and framed here.
import { track, playtime } from '../lib/track';
import { remember } from '../lib/recent';
const stage = document.querySelector<HTMLElement>('#stage')!;
const overlay = document.querySelector<HTMLElement>('#stage-overlay')!;
const note = document.querySelector<HTMLElement>('#stage-note')!;
const play = document.querySelector<HTMLButtonElement>('#play')!;
const stopButton = document.querySelector<HTMLButtonElement>('#stop')!;
const { game, url, launch, requires, platform, shelf } = stage.dataset as Record<string, string>;
const params = { game_id: game, platform, shelf };
const clock = playtime(params);
const coarse = matchMedia('(hover: none) and (pointer: coarse)').matches;
let frame: HTMLIFrameElement | undefined;

function maximise(on: boolean) {
  stage.classList.toggle('is-max', on);
  document.documentElement.classList.toggle('stage-locked', on);
}
function stop() {
  if (!frame) return;
  frame.remove(); frame = undefined;
  clock.stop();
  if (document.fullscreenElement) document.exitFullscreen();
  maximise(false);
  stage.querySelector('.stage-loading')?.remove();
  overlay.hidden = false; play.disabled = false; stopButton.disabled = true;
}
play.addEventListener('click', () => {
  track('play_click', params);
  remember(game);
  if (requires === 'webgpu' && !('gpu' in navigator)) {
    note.textContent = 'This game needs WebGPU, which this browser does not have. Try a current Chrome or Edge.';
    track('boot_error', { ...params, reason: 'no_webgpu' });
    return;
  }
  // Builds that need cross-origin isolation cannot run inside a frame.
  if (launch === 'tab') { window.open(url, '_blank', 'noopener'); return; }
  const started = performance.now();
  play.disabled = true;
  frame = document.createElement('iframe');
  frame.title = document.querySelector('h1')!.textContent || 'Game';
  frame.allow = 'gamepad; fullscreen; autoplay; cross-origin-isolated; screen-wake-lock';
  const bar = document.createElement('div'); bar.className = 'stage-loading';
  frame.addEventListener('load', () => {
    bar.remove();
    track('boot_success', { ...params, boot_ms: Math.round(performance.now() - started) });
    clock.start();
    frame?.focus();
  });
  frame.src = url;
  overlay.hidden = true; stopButton.disabled = false;
  stage.append(frame, bar);
  // The builds' touch controls expect the whole screen.
  if (coarse) maximise(true);
});
stopButton.addEventListener('click', stop);
document.querySelector('#stage-close')!.addEventListener('click', stop);
document.querySelector('#fullscreen')!.addEventListener('click', () => {
  track('fullscreen', params);
  if (stage.requestFullscreen) stage.requestFullscreen().catch(() => maximise(true));
  else maximise(true);
  frame?.focus();
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && stage.classList.contains('is-max') && !frame) maximise(false); });
