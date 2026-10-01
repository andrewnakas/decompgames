// Thin wrapper over gtag. A no-op when analytics is not configured or blocked.
type Params = Record<string, string | number | boolean | undefined>;
export function track(name: string, params: Params = {}) {
  const gtag = (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag;
  if (gtag) gtag('event', name, params);
}
// Counts foreground play time: one event per full minute, and the remainder when the page is left.
export function playtime(params: Params) {
  let since = 0, banked = 0, running = false;
  const visible = () => document.visibilityState === 'visible';
  const flush = (final: boolean) => {
    if (since) { banked += Date.now() - since; since = running && visible() && !final ? Date.now() : 0; }
    const seconds = Math.floor(banked / 1000);
    if (seconds >= 60 || (final && seconds >= 5)) { track('playtime_heartbeat', { ...params, seconds }); banked -= seconds * 1000; }
  };
  const timer = setInterval(() => flush(false), 15000);
  document.addEventListener('visibilitychange', () => { if (!running) return; if (visible()) since = Date.now(); else flush(false); });
  window.addEventListener('pagehide', () => flush(true));
  return {
    start() { running = true; since = visible() ? Date.now() : 0; },
    stop() { flush(true); running = false; since = 0; },
    dispose() { clearInterval(timer); },
  };
}
