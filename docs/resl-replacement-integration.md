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

This first generator covers the external presentation files needed for a replacement-only CMake target. It deliberately omits upstream demo and extra save files. No generated file has been tested in the engine yet, and the embedded C++ glyph tables remain unresolved.

## Remaining release gate

1. Add a reproducible build recipe that copies the pinned source, selects only generated external files, disables demo fallback, and structurally removes SDL audio initialization.
2. Replace or redraw every visual glyph table used during menu and representative play. Record which source tables are game mechanics and which are replaced presentation data.
3. Build from a pinned Emscripten revision and publish exact patches, generator sources, manifests, and checksums.
4. Run muted browser tests for loading, menu input, rail construction, train dispatch, a complete success/failure gameplay loop, and save/export/delete/import restoration.
5. Do not count or deploy Open Junction until those checks pass. A successful compile or title screen is insufficient.

## Negative candidate findings from this pass

- Fire & Forget II recompilation revision `e680ed2ed1f42f663bc9c1896a1742a39cebfda6` has an existing browser build and requires extracted original graphics, but its repository has no license grant for the reconstructed engine. It cannot be hosted under the open-source policy.
- Wacki describes itself as a from-scratch engine reimplementation. It is useful directory research but does not meet the user's strict decompilation category for additions 3–5.
