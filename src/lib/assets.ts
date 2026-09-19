export interface RuntimeAsset { path: string; url: string; label?: string; sha256?: string }
export interface LoadedAsset { path: string; bytes: Uint8Array }

/** Bound simultaneous requests while retaining manifest order and verifying bytes. */
export async function loadAssets(base: string, entries: RuntimeAsset[], progress: (done: number, total: number) => void): Promise<LoadedAsset[]> {
  const result: LoadedAsset[] = new Array(entries.length);
  const controller = new AbortController();
  let next = 0, done = 0;
  progress(0, entries.length);
  async function worker() {
    while (!controller.signal.aborted) {
      const index = next++;
      if (index >= entries.length) return;
      const entry = entries[index];
      try {
        const response = await fetch(base + entry.url, {signal: controller.signal});
        if (!response.ok) throw new Error(`Download failed (${response.status}): ${entry.label || entry.path}. Please try again.`);
        const bytes = new Uint8Array(await response.arrayBuffer());
        if (entry.sha256) {
          const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))).map(n => n.toString(16).padStart(2, '0')).join('');
          if (hash !== entry.sha256) throw new Error(`Game data checksum failed: ${entry.label || entry.path}.`);
        }
        // Another request may have failed while this digest was running.
        if (controller.signal.aborted) return;
        result[index] = {path: entry.path, bytes};
        progress(++done, entries.length);
      } catch (error) {
        controller.abort();
        throw error;
      }
    }
  }
  await Promise.all(Array.from({length: Math.min(4, entries.length)}, worker));
  return result;
}
