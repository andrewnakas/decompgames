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

This first generator covers the external presentation files needed for a replacement-only CMake target. It deliberately omits upstream demo and extra save files. The files compiled in the private build below, but have not been tested in a browser. The embedded C++ glyph tables remain unresolved.

## Private replacement-external-assets build

`scripts/build-resl-browser.py` reproducibly copies the pinned source into a fresh output directory, excludes the upstream top-level `resources/`, validates and embeds only the generated CC0 files, and builds with Emscripten 6.0.1. It removes SDL audio initialization and substitutes a null audio driver, so this candidate cannot emit sound. It records the hashes of every still-unreplaced embedded visual table and explicitly writes `releaseReady: false`.

The September 23 private build succeeded. Its `resl.js` is 189,490 bytes (SHA-256 `00dd6d4e2dc7a0989b4ba4e3b5d825f4511359217d703dac5ce00960d9295a66`) and `resl.wasm` is 1,593,111 bytes (SHA-256 `702ff647db819b872dec50a06f25d434f1b5088803f2a6a9f12696e34772772d`). These are **not release artifacts**. They have not been copied into the website, uploaded, or browser tested. The binary still contains upstream-derived presentation tables.

`scripts/generate-open-junction-glyphs.py` now draws four CC0 replacement source tables from independent geometric primitives: dispatcher, impasse, static objects, and train-completion flags. Its manifest records file hashes and confirms it reads no original asset data. A new private build compiled successfully with these four replacements; `resl.wasm` is SHA-256 `4dfc12d23843396d512370de390602650769e386a0ed075d7ae32f3e34c16a0e`. This candidate is also not published or browser tested.

Six tables still require replacement or a documented functional-data decision: `glyph_empty_background`, `rail_glyph`, `semaphore_glyph`, `small_font`, `text_glyphs`, and `train_glyph`. The pinned source's other tables represent positions, connections, movement, and train specifications; these need a separate provenance review before release. The detailed hash inventory is produced by the build recipe rather than hand-copied here.

## Remaining release gate

1. Confirm demo fallback cannot reach any original-data path. The private build recipe and silent audio backend are in place.
2. Replace or redraw every visual glyph table used during menu and representative play. Record which source tables are game mechanics and which are replaced presentation data.
3. Rebuild from the pinned Emscripten revision and publish the exact replacement sources, generator, manifest, and checksums only after the asset audit passes.
4. Run muted browser tests for loading, menu input, rail construction, train dispatch, a complete success/failure gameplay loop, and save/export/delete/import restoration.
5. Do not count or deploy Open Junction until those checks pass. A successful compile or title screen is insufficient.

## Negative candidate findings from this pass

- Fire & Forget II recompilation revision `e680ed2ed1f42f663bc9c1896a1742a39cebfda6` has an existing browser build and requires extracted original graphics, but its repository has no license grant for the reconstructed engine. It cannot be hosted under the open-source policy.
- Wacki describes itself as a from-scratch engine reimplementation. It is useful directory research but does not meet the user's strict decompilation category for additions 3–5.
