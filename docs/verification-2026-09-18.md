# Browser integration test log — September 18, 2026

Environment: Windows, Chromium-based Codex in-app browser, local production build.
This is a development record, not cross-browser certification or a completed playthrough.

| Integration | Observed | Still required |
| --- | --- | --- |
| Open Cadet | Table renders with replacement assets | Representative play, audible sound, high-score persistence |
| Freedoom Phase 2 | Attract demo, new-game menu, level start, keyboard firing, save menu | Save/reload, backup round trip, audible audio, normal-browser mouse capture |
| OpenTyrian | Game data loads, attract-mode rendering and SDL audio initialization | Input/menu transition under investigation; save/reload and audible audio |
| OpenTTD | WebAssembly compiled | Browser start, controls, transport gameplay, save/reload |
| ScummVM titles | Four-engine build compiled | Per-title runtime data and save validation |
| Doom / Quake imports | Header/bounds/duplicate-file validation tests pass | End-to-end local import, gameplay, saves, network inspection |

Freedoom reports a pointer-lock limitation inside the in-app browser. This does not establish compatibility or incompatibility in standalone Chrome, Edge, Firefox, or Safari.

Automated tests cover malformed/truncated WAD/PAK input, directory bounds, missing base IWAD, duplicate names, and backup path/version validation. No commercial game data is included in the repository.

## September 19 follow-up

- Live `play.decompgames.com` Open Cadet package downloads and renders the replacement table.
- Live Doom import successfully reads a locally selected Freedoom Phase 2 IWAD and runs its attract sequence. This tests the adapter using free data, not a commercial Doom campaign.
- OpenTTD generates a world from free base graphics and opens its save dialog. Backup download succeeds, but inspection found an empty file list; this is **not** a successful save-persistence test. In-game save and reload remain unresolved.
- Beneath a Steel Sky now plays its animated introduction after adding matching `sky.cpt` support data. No gameplay or save certification yet.
- Chromium's in-app browser reported a feature initialization error during the Doom import. Save controls now distinguish recoverable operation failures from engine aborts; export reads the in-memory files even if IndexedDB synchronization fails.
- Cloudflare production endpoints returned HTTP 200 for the catalog and HTTP 206 for an eight-byte WASM range with `application/wasm`. Apex, www, and player hostnames are active with certificates.
- GitHub CI passed the initial catalog, type, unit-test, build, and internal-link checks.
- The live Doom backup button was retested after making export independent of IndexedDB. It completed and downloaded a backup despite the browser feature warning. This validates the export recovery path, not a saved campaign round trip.

## September 19 — Freedoom persistence and backup round trip

Tested on the live player origin with runtime `ddf0347a4fc1-c8f4bcf00e`, in the Chromium-based in-app browser on Windows:

1. Started a new Phase 2 level, fired once (50 to 49 ammunition), opened F2, and saved slot 1 as MAP01. The game reported `GAME SAVED`.
2. Exported the backup. It contains a 70,469-byte `prboomX-savegame0.dsg`, a 112-byte save index, and a 66,305-byte color-map cache. This is an actual campaign save, unlike the previous cache-only Doom test.
3. Stopped the game, reloaded the page, started again, and used F3 to load MAP01. The same location, 49 ammunition, 100% health, and 0% armor were restored.
4. Fired again, saved the changed state with 48 ammunition, then imported the earlier exported backup. After restarting and loading MAP01, ammunition returned to 49 at the original location. This verifies that the imported backup replaced the newer state.

The browser feature initialization warning still occurs, but did not prevent these save checks. This does not establish mouse capture, audible audio, other-browser compatibility, or a full playthrough. The catalog remains labeled as a test build.

Backup validation now rejects file/directory path collisions in either ordering, trailing slashes, overly long paths, excess files, and excess bytes before filesystem mutation. Regression tests cover these cases. Follow-up work remains for rollback after an actual storage-write failure and safe coordination with running engine writes.
