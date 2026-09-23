# Persistent expansion backlog

## Active milestone: five additional playable decomps

User explicitly confirmed strict decomps with replacement assets. Track actual releases in `docs/five-playable-decomps.md`; current completion is 2/5 after Open Digger and Open Paths passed production verification. Do not count released-source games, current hosted titles, editions, or asset prototypes. Open Paths has an immutable runtime, exact-source archive, 14-file CC0 replacement package, null audio backend, completed first-level loop, fresh-start progress, and export/delete/import restoration. Its complete six-level playthrough remains unverified. Open Digger's full eight-level playthrough and high-score-entry flow also remain unverified and are not claimed.

### Addition 3 candidate: reSL / Open Junction

Pinned reSL revision `470cca330ee9abcf6173c843f4c89686c0c7e525` is a GPL-3.0 ShortLine decompilation with an upstream Emscripten target. The first feasibility build contained original resources and was never published. The current private Open Junction candidate replaces external art, glyphs, cursor, scenario, station colors, and runtime palette with generated CC0 data. Its corrected entrance schedule resolved the observed idle hang. Muted private Chromium now reaches Go, starts the gameplay loop, commits a player-placed center-tile rail, generates a second entrance, dispatches a train, and observes one completed train delivery. The pause-menu Save writes an IDBFS file that survives explicit sync and browser reload, but in-game Archive restoration and user-facing export/import remain unverified. A complete campaign objective, visual review, and remaining functional-data audit still block release. See `docs/resl-replacement-integration.md`; do not deploy or count it yet.

## September 21 replacement-assets priority

Asset authoring follow-up: original font generators and static tiles 0–7 are implemented with manifests and vector previews. A tested planar encoder creates the engine's DAT format. All 23 tests pass. Next: runtime palette, moving-sprite coordinates/animations, menu/panel artwork, six-level campaign handling, then muted visual/gameplay tests using only the replacement pack. The generated files remain local and unverified in-engine; no public promotion.

The user now requests more playable decomps with fully independent replacement assets. Open Paths is released; prioritize finding and building eligible additions 3–5, including Open Cadet only if it represents a distinct new qualifying release rather than recounting the existing hosted title. Preserve Zelda's experimental local-file adapter but pause further expansion there for this priority.

## September 20 user priority change

Focus upcoming work on actual decompilations. Additional ScummVM integration and broad engine-recreation expansion are paused at the user's request. Existing launch-gate work remains recorded below but no longer determines the order of expansion. Keep all tests muted.

Next: Open Cadet gameplay checks; OpenSupaplex's existing WebAssembly recipe and assembly-to-C provenance; local-file browser adapters for documented decomps. CannonBall is a researched decompilation-derived directory candidate, but its noncommercial license excludes hosting under the current open-source policy. See `docs/decompilation-research-2026-09-20.md`.

OpenSupaplex build progress: the data-free Asyncify engine now compiles using `scripts/build-supaplex-browser.py`; source patch, artifact hashes, and proposed save mount are recorded in the research document. Browser launch, input/timing, save persistence, and asset permissions remain open. Keep the public entry discovery-only.

OpenSupaplex local test: `scripts/preview-supaplex.mjs` reached the rendered title screen while muted. Enter/ArrowDown automation did not advance it; investigate keyboard-state polling and delivery next. MOD decoding is missing from this build. Export contained zero files, so saves remain unverified. Full evidence and the corrected harness URL failure are in the test log. The test player and local server were stopped.

Follow-up: a key-tap latch and MOD-enabled build reached the main menu after Enter, and SDL audio initialization now succeeds while output remains muted. New-player/menu activation is still unresolved; inspect mouse-button sampling and `getMouseStatus` next. Do not mark complete gameplay, music, or saves verified. Exact new hashes and remaining limitations are in the test log.

Latest Supaplex result: retained mouse clicks allow player creation and first-level launch. Two Up taps collected an Infotron (019 → 018), and player V survived a full page reload. Profile export contains PLAYER.LST and HALLFAME.LST. Next: in-level snapshot round trip, one completed puzzle, held input and focus-loss behavior, then asset/source release prerequisites. Public entry stays discovery-only; no hosted build yet.

## New port experiment: Zelda3

A Link to the Past's C reconstruction now compiles into a data-free 2.22 MB WASM engine using `scripts/build-zelda3-browser.py`. Asyncify yielding and two function-signature fixes are included. No browser test or proprietary data was used, and no public playable claim was added. Next: validated local asset import, save mount, rendering/input checks, and muted gameplay/save tests. See `docs/zelda3-browser-integration.md` for the exact revision, recipe, hashes, and remaining gates. Fire & Forget II is another WASM lead blocked on a clear engine license grant.

## Strict replacement candidate: Open Junction

reSL's documented ShortLine decompilation now has independent CC0 external assets, ten generated replacement visual/mask tables, a replacement SDL cursor, and a candidate independent board, entrance set, train roster, rail redraw bounds, entrance colors, and runtime palette. The private build has a null audio backend and uploaded no binary. A six-site manifest-recorded schedule fixed the observed idle hang in private run 35830267769. Run 35830690398 confirmed Go menu input; run 35831389601 confirmed first gameplay ticks. The corrected rail test in run 35832131011 observed a right click on tile (5,5), a queued construction action, and rail count rising beyond the initial entrance rail without browser errors or off-origin requests. A 640×480 screenshot review found a squeezed test viewport and overly bright board; run 35835062487 passed after the visual recipe used a dark independent palette, omitted grass speckles, and replaced the inherited footer. Run 35836572956 passed second-entrance creation, train dispatch, and movement with a three-piece CC0 starter route. Run 35857423464 reached the successful-delivery branch with no browser errors, completing one train trip. Next: test a campaign objective and save restoration. The upstream Emscripten filesystem mounts IDBFS with `autoPersist: true` but loads it asynchronously; verify save-file availability after page reload before claiming persistence. Numeric legibility, tree density, and motion-data provenance remain open. This build is not counted toward additions 3–5. See `docs/resl-replacement-integration.md` for pinned revision, artifact hashes, and release blockers.

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

### September 23 strict-candidate exclusions

- [G-Diffuser](https://github.com/Zorkats/G-Diffuser) is a documented F-Zero X decompilation-based PC port, but upstream requires a user-provided cartridge ROM, Expansion Kit disk image, and IPL ROM. Its generated game-data archive is derived from those files and explicitly cannot be redistributed. It has no independently authored complete replacement game pack, so it cannot count toward the five instant-play releases; keep it for directory or future local-file research.
- [Streets of Rage Project](https://github.com/RuiNelson/StreetsOfRageProject) requires a private 512 KiB cartridge ROM even to generate its C++ output; the generated directory is absent from a fresh clone. Its README places removal of Mega Drive hardware emulation and higher-resolution replacement assets on a future roadmap. It is not yet an eligible complete replacement-asset browser release. Revisit only if its source and asset boundary changes.

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
