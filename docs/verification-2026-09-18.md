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

## September 19 — OpenTyrian and bounded downloads

Live runtime `c398647f17fa-c82432af60` in the same Windows in-app Chromium environment:

- Exited attract mode; selected Start New Game, 1 Player Full Game, Episode 1, Normal; reached the ship menu and launched the first Tyrian mission. The mission rendered and eventually returned to the ship menu after an unattended death. This does not verify sustained player control or a completed level.
- Opened Options → Save, selected slot 1, entered `v`, and confirmed. The named slot appeared. The exported backup contains `tyrian.sav` (2,502 bytes), `tyrian.cfg` (28 bytes), and `opentyrian.cfg` (313 bytes).
- Stopped, reloaded the page, and started again. The title menu appeared but a subsequent navigation attempt left a black canvas and input actions timed out. No fatal engine error was logged; the earlier Chromium feature initialization warning remains. In-game reload is **not verified**.
- Export after restart still contained the save and both configuration files. Configuration hashes match the earlier export. The save hash changed; do not infer identical restored game state from file presence alone.
- Shared loading now uses four concurrent requests instead of sequential downloads. The live counter advanced through 106 Tyrian assets and the engine booted. Unit tests cover the concurrency bound, retained ordering, SHA-256 rejection, and cancellation after HTTP failure. No controlled before/after performance figure is claimed.

The black-screen behavior also occurred before this loader change in an earlier test. Its cause remains unresolved; investigate engine/event handling and saved configuration before treating menu transitions as reliable. Audio remains unverified.

## September 20 — exit diagnosis and silent testing

The earlier interpretation of the black canvas as a menu freeze was incomplete. DOM inspection found a 0 × 0 canvas. In the pinned OpenTyrian source, Escape in `titleScreen()` sets the quit flag; `JE_tyrianHalt()` destroys SDL video before exiting. SDL's Emscripten backend implements window destruction by resizing the canvas to zero. The prior build kept the runtime alive and did not notify the shell of this exit.

Rebuilt the same upstream revision with `-sEXIT_RUNTIME=1`, producing package `c398647f17fa-4ccedff7db`. The shell now synchronizes browser storage before handling engine exit. In local testing, Escape at the settled title menu returned to the launch screen with “Game exited. Local saves synchronized. Start again when you are ready.” The old named save also appeared in the live new runtime's Load Game list after a fresh start. Loading that slot into gameplay is still pending; do not claim a completed save round trip.

Published corresponding source archive SHA-256: `7e7ced946559125813beed576e1e0ae1ec3adc6bb40692a5c95a10ec3663b494`. Downloaded bytes matched the manifest's hash and size. Earlier source revisions remain available for rollback.

After the user requested silence, all open test players were closed. A Web Audio master gain is now installed before engine loading and defaults to zero. The Sound control requires explicit opt-in, and each game start resets it to off. Automated tests verify muted initial output, future contexts, toggles, preserved internal connections, and disconnection routing. These are routing tests, not audible audio certification. All subsequent development must remain muted.

## September 20 — Lure test stopped after priority change

Live ScummVM package `b603fb5f8e60-00d75e7331`, Windows in-app Chromium, Sound: off throughout: startup reached the cell scene, clicking moved Diermot toward the straw pile, and F5 opened the native Save game dialog. No named save or restored state was verified. The user then requested actual decompilations instead of further ScummVM work. Stopped the player (the shell reported saves synchronized) and closed the test tab. No verification-status promotion is justified by this partial test.

## September 20 local / September 21 UTC — OpenSupaplex startup

Tested the experimental engine with WASM SHA-256 `d5b31863a26b3b1b33686f7e7086016df9078144ef4d0e246e33ab68ad07424a` using `scripts/preview-supaplex.mjs` on loopback port 4323, Windows in-app Chromium. The harness serves upstream resources directly from the local checkout, never from public deployment storage. The shared player audio gate stayed muted throughout.

- Initial harness asset URLs failed with 404 because the shared loader concatenates the runtime base. Corrected them to relative URLs; subsequent load reached OpenSupaplex's rendered 7.2.2 credits/title screen and enabled shell controls.
- Enter and ArrowDown via browser automation did not advance the title screen. No fatal runtime error was reported. The cause is unresolved: inspect key-down/up delivery and the engine's SDL keyboard-state polling before claiming controls work. No gameplay was observed.
- SDL_mixer reported MOD support unavailable. This build cannot claim working music, even apart from the deliberate output mute. Advanced-config read warnings occurred on the fresh save namespace.
- Export returned a valid experimental-1 envelope with zero files. This confirms only an empty export, not game-save creation or reload.
- Stop returned synchronized-save confirmation. Closed the test tab and stopped the harness server afterward. No engine or game data was published and the catalog verification status remains unchanged.

### Follow-up — input sampling and MOD decoding

Built an experimental revision with `SDL2_MIXER_FORMATS=mod` (Emscripten's pinned libmodplug port) and a keyboard tap latch. Key-down events are retained until the next keyboard-state sample, then cleared; held keys still come from SDL state. This addresses a possible missed-tap path without claiming all input is fixed.

Muted local test reached the main menu after Enter, unlike the preceding attempt. The log now reported audio initialized at 48 kHz without the MOD-support failure. This verifies initialization only, not audible output or music correctness. A click on New player and further Enter/ArrowDown inputs did not visibly establish player creation or gameplay. Investigate `getMouseStatus` and its polling before broadening input claims. Saves were not retested. Stop succeeded, test tab closed, server stopped.

Output remains local at `/home/nakas/decompgames-build/supaplex-browser-input`. WASM: 1,660,211 bytes, SHA-256 `1d163045a19d7066791561894c23dd8260a7e9302a9c651ec7d3af3af8ab18a5`; JS: 198,994 bytes, SHA-256 `265b01e26ae95153796b191312806d37f2c6f40ade9569e41c65c0ee769ff99d`. Generated system patch SHA-256 `c2ba295721b000246fc2734d2cec3684131dd3c592aa5fc82d871269b5852ac2`; keyboard patch SHA-256 `4a571353073b27d3ed9e5f19b4efabae9f500b9f8b7ba8db94fc64aff0da2d43`. The recipe and build record capture all generated changes. No binaries or game assets published.
