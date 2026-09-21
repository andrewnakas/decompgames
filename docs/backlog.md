# Persistent expansion backlog

## September 21 replacement-assets priority

The user now requests more playable decomps with fully independent replacement assets. Prioritize Open Cadet verification and a new OpenSupaplex replacement pack. `docs/replacement-assets.md` records the evidence and asset inventory. Six independently generated navigation-level prototypes pass static reachability checks; they have not been played in-engine and do not form a complete asset pack. Artwork, UI, fonts, sound policy, campaign handling, and gameplay testing remain. Preserve Zelda's experimental local-file adapter but pause further expansion there for this priority.

## September 20 user priority change

Focus upcoming work on actual decompilations. Additional ScummVM integration and broad engine-recreation expansion are paused at the user's request. Existing launch-gate work remains recorded below but no longer determines the order of expansion. Keep all tests muted.

Next: Open Cadet gameplay checks; OpenSupaplex's existing WebAssembly recipe and assembly-to-C provenance; local-file browser adapters for documented decomps. CannonBall is a researched decompilation-derived directory candidate, but its noncommercial license excludes hosting under the current open-source policy. See `docs/decompilation-research-2026-09-20.md`.

OpenSupaplex build progress: the data-free Asyncify engine now compiles using `scripts/build-supaplex-browser.py`; source patch, artifact hashes, and proposed save mount are recorded in the research document. Browser launch, input/timing, save persistence, and asset permissions remain open. Keep the public entry discovery-only.

OpenSupaplex local test: `scripts/preview-supaplex.mjs` reached the rendered title screen while muted. Enter/ArrowDown automation did not advance it; investigate keyboard-state polling and delivery next. MOD decoding is missing from this build. Export contained zero files, so saves remain unverified. Full evidence and the corrected harness URL failure are in the test log. The test player and local server were stopped.

Follow-up: a key-tap latch and MOD-enabled build reached the main menu after Enter, and SDL audio initialization now succeeds while output remains muted. New-player/menu activation is still unresolved; inspect mouse-button sampling and `getMouseStatus` next. Do not mark complete gameplay, music, or saves verified. Exact new hashes and remaining limitations are in the test log.

Latest Supaplex result: retained mouse clicks allow player creation and first-level launch. Two Up taps collected an Infotron (019 → 018), and player V survived a full page reload. Profile export contains PLAYER.LST and HALLFAME.LST. Next: in-level snapshot round trip, one completed puzzle, held input and focus-loss behavior, then asset/source release prerequisites. Public entry stays discovery-only; no hosted build yet.

## New port experiment: Zelda3

A Link to the Past's C reconstruction now compiles into a data-free 2.22 MB WASM engine using `scripts/build-zelda3-browser.py`. Asyncify yielding and two function-signature fixes are included. No browser test or proprietary data was used, and no public playable claim was added. Next: validated local asset import, save mount, rendering/input checks, and muted gameplay/save tests. See `docs/zelda3-browser-integration.md` for the exact revision, recipe, hashes, and remaining gates. Fire & Forget II is another WASM lead blocked on a clear engine license grant.

## Current release gate

- [ ] Eight complete instant-play games with documented gameplay/audio/save checks.
- [ ] Two local-file integrations with end-to-end import and no-upload verification.
- [x] Thirty catalog records with individual routes and explicit test scope.
- [ ] Public GitHub source, matching binary source archives, notices, deployment, and rollback checks.

## Finish before broad expansion

1. Finish Open Cadet high-score/input tests. Its published preload is now restricted to replacement DAT/WAV assets.
2. Freedoom save/reload and backup export/import passed on September 19; finish audible audio, mouse capture, and representative gameplay checks. Doom local import boots with a free Freedoom IWAD; its own save and network checks remain.
3. OpenTyrian reached the first mission and a named save slot. The zero-size black canvas was traced to the game's normal quit path without runtime exit notification; the new build returns to Start and synchronizes saves. The saved slot appears after restart and runtime upgrade. Finish loading it into gameplay, backup import, and sustained controls. Keep testing muted; audible audio remains unverified.
4. Test OpenTTD with OpenGFX/OpenSFX; keep missing browser music support explicit.
5. Verify ScummVM support data, intro skips, gameplay input, and saves for BASS, Lure, Queen, and Sołtys.
6. Test Quake with locally supplied compatible data. Do not publish commercial PAK files.
7. Make backup replacement recover from write failures and coordinate mutations with running engine writes; check large saves against the current 8 MiB import limit.

### September 19 persistence pass

The live Freedoom save and backup round trip passed with distinct pre-import and post-import ammunition counts. Added regression coverage for conflicting backup paths and size/count limits. Fixed `fetch:games` so a fresh clone retrieves the pinned asset tree instead of requiring an untracked local cache. No new catalog entries or coverage claims were added during this integration pass.

### September 19 OpenTyrian / loading pass

Tested live runtime `c398647f17fa-c82432af60`: menu navigation, episode selection, ship menu, first mission, and named save creation observed. A later black-screen menu transition remains reproducible enough to block promotion. The shared loader now downloads at most four assets concurrently, verifies each SHA-256, preserves manifest order, and cancels outstanding requests on failure. Local and live OpenTyrian boot passed with this loader; this is not a controlled startup benchmark. A future asset audit should remove unused DOS utilities from the 106-file Tyrian runtime preload while preserving required data and notices.

### September 20 exit handling and silent development

OpenTyrian now uses `EXIT_RUNTIME=1` so the shell receives its exit notification. Local testing confirmed Escape at the title menu returns to Start with synchronized-save confirmation. Runtime `c398647f17fa-4ccedff7db` includes a matching source archive and its SHA-256. The old save slot appeared in the new live runtime's Load Game list; loading back into gameplay remains unverified.

The user explicitly requested no audible development tests. Follow `AGENTS.md`: keep sound off, do not toggle it on, and close test players afterward. The player now installs a muted Web Audio output before loading the engine; every start resets the control to Sound: off. Unit tests cover existing/new contexts and graph connection behavior. Audible testing is deferred until explicitly authorized.

## Next integrations

- OpenRCT2: pinned upstream browser-source review and local-folder validator completed; see `docs/openrct2-integration.md`. Blockers are its modular/threaded runtime, cross-origin isolation, dependency pinning, resource-budget changes, and end-to-end testing with original files. Do not expose a Play action yet.

- ScummVM freeware: Dráscula, DreamWeb, Sfinx, The Griffon Legend; then God of Thunder and other current freeware candidates. Review each engine and data license separately.
- Local adapters: OpenLara, RigelEngine, OpenRCT2, OpenJazz.
- Consider additional open-data games on existing runtimes only when they are genuinely distinct games. Do not count editions, demos, or repeated engine builds as extra games.

## Discovery coverage to research

- r/decomps: initial scan and primary checks recorded in `docs/reddit-opportunities-2026-09-20.md`. Prioritize Mario Kart 64 / SpaghettiKart license and browser feasibility; watch OpenPete for public source. Use community requests for clear project status and mod links to inform game pages. Do not confuse wishlist threads with available decomps.

- decomp.dev and its upstream directory; preserve progress-vs-playability distinctions.
- Reverse engineering and source-port indexes, then primary source repositories.
- ScummVM supported engine/game tables and authorized freeware collection.
- Doom/Quake source-derived games, released-source strategy games, and independently licensed data sets.
- Recompilation projects and console decompilation projects with substantial upstream documentation.
- Candidate engine recreations: OpenRA, OpenXcom, OpenMW, DevilutionX, Exult, GemRB, FreeSpace Open, DXX-Rebirth, The Force Engine, OpenJK, OpenTESArena, OpenNox, OpenOMF, REminiscence, RE2/RE3 projects only after provenance review.

## Per-pass procedure

Deduplicate by original game and record project variants as related sources. Find primary documentation, inspect exact license files, explain required data and supported editions, and write original setup guidance. Only add a record when the evidence supports its technical category. Add runtime work in small, testable changes. Keep unsuccessful tests in the log rather than erasing them. Recheck changed licenses before hosting a new revision.

The hourly follow-up is configured in Codex as `Expand Decomp Games`. It should notify only for meaningful releases, failures, completion, or needed user action.
