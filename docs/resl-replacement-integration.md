# reSL / Open Junction replacement integration

## Eligibility and pinned evidence

- Upstream: https://github.com/konovalov-aleks/reSL
- Examined revision: `470cca330ee9abcf6173c843f4c89686c0c7e525`
- Engine license: GPL-3.0 (`LICENSE` SHA-256 `230184f60bae2feaf244f10a8bac053c8ff33a183bcc365b4d8b876d2b7f4809`)
- Decompilation evidence: upstream identifies reSL as a fully restored version of ShortLine 1.1, identifies the original executable hash, and retains address comments in the `original` branch.
- Browser basis: upstream has an Emscripten CMake target and a public browser build.

This is an eligible strict-decomp engine candidate. It is not yet a qualifying Decomp Games release.

## Asset boundary

Upstream explicitly says `resources/` contains original ShortLine files. The Emscripten target embeds `play.7`, `GAMEOVER.7`, 20 demo saves, `captions.7`, `poster.7`, `RULES.TXT`, five extra saves, and four reSL interface icons. None of those files will be distributed in the proposed replacement build.

The C++ source also contains generated glyph and gameplay tables under `src/game/resources/`. Several are visual data reconstructed from the original executable, including fonts, trains, track, signals, entrances, and static objects. They remain an asset-audit blocker even though they compile into the engine binary. A release must replace every visual table used by the new campaign and distinguish gameplay rules from copyrightable presentation data.

## Exploratory build

The unmodified pinned revision compiled successfully with the upstream Emscripten target and Emscripten 6.0.1. This private feasibility build used upstream resources and was not opened in a browser, copied into the site, or uploaded.

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| `resl.js` | 189,718 | `ecc4412d6ce9340a010decbaa7060cade0846cec977dcacb013ccc50bb5136da` |
| `resl.wasm` | 1,840,701 | `5d5e84dbf33054b09e63b115d92eb32ae18eeffc9651dd0bd000ec3d46694259` |

These hashes prove only that the pinned code builds. They are not release artifacts because the WASM embeds upstream original resources.

## Independent external-data prototype

`scripts/generate-open-junction-assets.py` now creates replacement loading, background, game-over, interface-icon, and manual files without reading upstream resources. It implements and round-trips the engine's planar `.7` format, writes pure-Python PNG icons, records per-file hashes, and dedicates generated data under CC0-1.0. The prototype is named **Open Junction**.

This first generator covers the external presentation files needed for a replacement-only CMake target. It deliberately omits upstream demo and extra save files. The files compile and the current private build reaches runtime initialization in Chromium, but their in-game appearance has not been verified.

## Private replacement-external-assets build

`scripts/build-resl-browser.py` reproducibly copies the pinned source into a fresh output directory, excludes the upstream top-level `resources/`, validates and embeds only the generated CC0 files, and builds with Emscripten 6.0.1. It removes SDL audio initialization and substitutes a null audio driver, so this candidate cannot emit sound. It records the hashes of every still-unreplaced embedded visual table and explicitly writes `releaseReady: false`.

The September 23 private build succeeded. Its `resl.js` is 189,490 bytes (SHA-256 `00dd6d4e2dc7a0989b4ba4e3b5d825f4511359217d703dac5ce00960d9295a66`) and `resl.wasm` is 1,593,111 bytes (SHA-256 `702ff647db819b872dec50a06f25d434f1b5088803f2a6a9f12696e34772772d`). These are **not release artifacts**. They have not been copied into the website, uploaded, or browser tested. The binary still contains upstream-derived presentation tables.

`scripts/generate-open-junction-glyphs.py` draws four CC0 replacement source tables from independent geometric primitives: dispatcher, impasse, static objects, and train-completion flags. Its manifest records file hashes and confirms it reads no original asset data. A private build compiled successfully with these four replacements; `resl.wasm` is SHA-256 `4dfc12d23843396d512370de390602650769e386a0ed075d7ae32f3e34c16a0e`. This candidate is also not published or browser tested.

The generator now also writes two independent font tables (`small_font` and `text_glyphs`) from a hand-authored five-column drafting alphabet, a semaphore sprite table drawn as an original signal-post icon, a functional full-bit erase mask, rail art drafted from six possible connections among four isometric ports, and a train family drawn from boxes, wheels, and windows. The engine's 256-character small-font indexing, 147-entry text table, four semaphore orientations, six rail types, and 15 train types are preserved. Unsupported characters use a visible fallback mark. All ten tables compiled privately in GitHub Actions; browser visual review remains blocked by the idle hang. Text legibility, localized characters, track/signal alignment, train appearance, and the gameplay effects of uniform train dimensions remain unverified.

All ten previously identified embedded visual/mask tables now have independently generated replacements. This does not close the asset audit: other source files and the remaining position, connection, movement, and train-specification tables still need provenance review. The detailed hash inventory is produced by the build recipe rather than hand-copied here.

The manual GitHub Actions workflow `open-junction-feasibility.yml` compiled this private candidate successfully in [run 35814744907](https://github.com/andrewnakas/decompgames/actions/runs/35814744907). Emscripten 6.0.1 produced `resl.js` (189,490 bytes, SHA-256 `7d4b59d9c0edadff3e23b1f5fc924e08d3da1654478df519ac24ed5e6036f629`) and `resl.wasm` (1,577,663 bytes, SHA-256 `12c9af110cb5fa6e4db6d72a6971b875be6632b868a189f599c45e7f3b4771c1`). CI uploaded no binary artifact, asserted `releaseReady: false`, and did not test gameplay. These hashes identify a private compile, not a release.

The broader source audit found two additional original-derived 16×16 mouse cursor planes in `src/system/driver/sdl/mouse.cpp`. The independent generator now creates a replacement outlined pointer as `cursor.json`, and the build recipe validates its checksum and patches both planes before compilation. This updated private build compiled in [run 35814959591](https://github.com/andrewnakas/decompgames/actions/runs/35814959591): `resl.js` stayed 189,490 bytes with SHA-256 `7d4b59d9c0edadff3e23b1f5fc924e08d3da1654478df519ac24ed5e6036f629`; `resl.wasm` was 1,577,566 bytes with SHA-256 `1fd881a05aeb84eea0fcc5c57edd145d587002e8505108404b10de97a5ebb926`. CI again uploaded no binary and asserted the release gate remains closed. Cursor appearance is untested.

The next asset boundary is the original-derived scenario data under `src/game/resources/`. `allowed_cursor_rail_types` restricts the build grid, and `entrance_rails` defines 46 eligible entrance locations; these look like level design rather than reusable engine rules. `train_specification` holds campaign train compositions and values. `scripts/generate-open-junction-scenario.py` now independently defines a symmetric board, two opposing banks of entrance locations, a new train roster, and broad redraw bounds for the larger rail sprites. It reads no original data and records CC0 hashes. This is a **candidate**, not a proven playable campaign; entrance selection, routing, collision rules, scoring, and a complete loop still need muted browser tests. `movement_paths`, connection rules, biases, and rail metadata appear to support engine motion and geometry; their role needs a separate functional-data review. This classification is provisional, not a legal clearance.

The new rail sprites use a 192×43 canvas. The pinned `g_chunkBoundingBoxes` ranges are narrower for some rail types, so incremental redraw can leave stale pixels unless those functional bounds are recomputed. The uniformly sized train glyphs may also change carriage spacing because movement code reads glyph widths. Both issues require a compiled, muted gameplay pass and likely geometry adjustment before release.

See [the provisional source-data audit](resl-source-data-audit.md) for every identified table, its likely role, and the remaining review work.

The manual CI workflow also includes a **private browser smoke test** with the null audio driver and Chromium's mute flag. It checks runtime initialization, canvas size, page errors, and off-origin requests. It uploads no images. These observations establish only browser startup; they cannot certify menu progression, gameplay, persistence, or redistribution readiness. The first attempt timed out during Chromium screenshot capture; a second attempt stalled during pixel inspection and was cancelled after three minutes. Later attempts avoided both operations and had a 45-second process limit.

The replacement scenario compiled in [run 35815903124](https://github.com/andrewnakas/decompgames/actions/runs/35815903124). Its private `resl.js` is 189,490 bytes (SHA-256 `7d4b59d9c0edadff3e23b1f5fc924e08d3da1654478df519ac24ed5e6036f629`) and `resl.wasm` is 1,577,569 bytes (SHA-256 `0c1c917b6e6f4818172c99b65962dd7b59e01c43fa99cf5dc640aafc4df73dd9`). No binary was uploaded. The first browser smoke [run 35819927541](https://github.com/andrewnakas/decompgames/actions/runs/35819927541) failed because Playwright timed out taking a screenshot; it did not establish a game failure or successful launch. The third smoke [run 35824375580](https://github.com/andrewnakas/decompgames/actions/runs/35824375580) reached `onRuntimeInitialized`, produced a 640×480 canvas, and had no page errors, stderr, or off-origin requests during the 12-second observation. After Playwright sent Enter, a second state read became unresponsive and the 45-second process limit ended the test. A fourth smoke [run 35824790463](https://github.com/andrewnakas/decompgames/actions/runs/35824790463), with the engine's melody flag disabled, showed the same initial state and stalled on a read after the valid Go (`G`) shortcut. A fifth smoke [run 35825286995](https://github.com/andrewnakas/decompgames/actions/runs/35825286995) disabled the menu's idle demo load and showed the same 12-second startup state, but again stalled on the later read after Go. The passive sixth smoke [run 35825608587](https://github.com/andrewnakas/decompgames/actions/runs/35825608587) sent **no input**. Reads succeeded at 3, 8, and 13 seconds, then the read scheduled for 18 seconds stalled until the 45-second process limit. The problem is therefore time-dependent and cannot be attributed to keyboard input alone. Browser startup is observed, but sustained responsiveness, input, and gameplay remain unverified.

The asset audit also found that the initial entrance color combinations and SDL runtime palette were still upstream presentation data. The current private candidate generates CC0 entrance colors and patches the renderer's 16 colors from the independent asset generator's recorded RGB palette. Generated loading and poster previews were inspected locally. The candidate compiled in [run 35826004953](https://github.com/andrewnakas/decompgames/actions/runs/35826004953), but the workflow then stopped on a stale assertion expecting four scenario files instead of five; its browser step did not run. The assertion was corrected in [run 35826170962](https://github.com/andrewnakas/decompgames/actions/runs/35826170962). That run compiled `resl.js` (189,490 bytes, SHA-256 `7d4b59d9c0edadff3e23b1f5fc924e08d3da1654478df519ac24ed5e6036f629`) and `resl.wasm` (1,578,108 bytes, SHA-256 `05d5083abead0ce3b0092aec8833aa517119c713ff3f94569b7ef11ec36b8772`) without uploading either binary. Its passive browser reads succeeded at 3, 8, and 13 seconds but stalled before 18 seconds, even after the main-menu timeout decrement was removed. The idle-responsiveness bug is independent of the timeout branch, input, and audible output in these tests; the exact engine cause remains unknown. Runtime contrast, menu interaction, and gameplay remain unverified.

The traced private run [35828810324](https://github.com/andrewnakas/decompgames/actions/runs/35828810324) reached runtime initialization and reproduced the 13–18-second stall, but emitted no main-menu frame traces. Source review explains why that trace was too late: `showLoadingScreen()` normally cycles six caption phases with 220 retraces each plus transitions, about 24 seconds at 60 FPS. The next private recipe shortened the independently authored title card to about one second. In [run 35829212839](https://github.com/andrewnakas/decompgames/actions/runs/35829212839), the page then became unresponsive before the first 3-second state read. This supports a transition-related problem but does not identify the failing function. A stage-trace attempt in [run 35829562359](https://github.com/andrewnakas/decompgames/actions/runs/35829562359) stopped before compilation because its marker matched more than one `createNewWorld()` call; the instrumentation is now scoped to the initial main-menu transition. This is diagnostic work, not a verified fix.

## Remaining release gate

1. Locate and fix the private build's 13–18-second idle hang; then confirm the demo fallback cannot reach original data. The silent audio backend is in place.
2. Inspect the compiled fonts, signals, erase mask, rails, trains, and colors in gameplay. Audit remaining non-glyph source data before deciding the replacement build is redistributable.
3. Rebuild from the pinned Emscripten revision and publish the exact replacement sources, generator, manifest, and checksums only after the asset audit passes.
4. Run muted browser tests for loading, menu input, rail construction, train dispatch, a complete success/failure gameplay loop, and save/export/delete/import restoration.
5. Do not count or deploy Open Junction until those checks pass. A successful compile or title screen is insufficient.

## Negative candidate findings from this pass

- Fire & Forget II recompilation revision `e680ed2ed1f42f663bc9c1896a1742a39cebfda6` has an existing browser build and requires extracted original graphics, but its repository has no license grant for the reconstructed engine. It cannot be hosted under the open-source policy.
- Wacki describes itself as a from-scratch engine reimplementation. It is useful directory research but does not meet the user's strict decompilation category for additions 3–5.
