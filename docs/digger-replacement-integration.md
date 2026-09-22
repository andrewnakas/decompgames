# Digger replacement-build integration

Status: released and counted as addition 1 of 5 after production verification on September 22, 2026.

## Pinned engine and browser build

- Upstream: https://github.com/sobomax/digger
- Revision: `e85cab1164f0304b3e66f371a5997d83f7a0090a`
- Toolchain: Emscripten 6.0.1 at `25e4e8d6550d392ba9e0c2936bce7cf41ee47cc0`
- Upstream already provides an SDL2/WebAssembly target with Asyncify.

`scripts/generate-open-digger-levels.mjs` creates eight 15×10 layouts without reading original maps. The generated `open-levels.inc` is CC0-1.0, 1,778 bytes, SHA-256 `656907a1eae16f95dd5471fc08de0aaeec84d61f8f5c91e4e2642efec129f9bf`. The first layout has a deterministic one-emerald completion route from the documented player start; levels 2–8 retain broader layouts that still need playthroughs.

`scripts/generate-open-digger-graphics.py` generates replacement CGA and VGA tables, a title, and an icon from new geometric definitions. `scripts/generate-open-digger-font.py` generates the font from a compact independent glyph map. The scripts read the pinned C files only for symbol names, array lengths, and pointer-table order; they do not reuse initializer values. The CC0 output records are:

| Generated source | Bytes | SHA-256 |
| --- | ---: | --- |
| `cgagrafx.c` | 66,210 | `d1f4c0b354ca6649561d8f91fa8792f262276d30c8514a8e9286d65afc1bf900` |
| `vgagrafx.c` | 859,537 | `b09cfcf39b9fafa968b84cd8e3d9e1aece93a7ef8602e552eb8e4ff3564595f5` |
| `title_gz.c` | 4,913 | `8312f5e3e9e183d1693ea99d68b062e030c3ea961ae25c6bf7457774da5b1a2a` |
| `icon.c` | 61,510 | `5e53e0dedf75ed5a63016bbd5abb3d6f4bffe62852d8298ce5654f08855c51ac` |
| `alpha.c` | 127,269 | `8bebe6c24b2638f7227373e3b7d81a1556dbe79650185717f82f4fe774d43b80` |

`scripts/build-digger-browser.py` checks the exact source revision, refuses a dirty checkout, validates the replacement manifests, and builds in a copied source tree. It removes `_SDL_SOUND`, which selects upstream's no-audio branches and preprocesses the upstream tune tables out of the WASM. Quiet mode is also the compiled default because the Emscripten loader replaces `Module.arguments` from URL parameters. The shell still forces `/Q`, uses replacement-build branding, and omits sound controls. A three-poll browser tap latch prevents short accessible key taps from disappearing between the engine's 12.5 Hz polls. The current successful internal build produced:

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| `digger.js` | 381,957 | `1f13719a3803e6f771d0f83a5dbc886b4c703b029e2227127373ed2414275d98` |
| `digger.wasm` | 4,885,753 | `2ba36234c08ca632483ff7613010a45a077c4a941585e7de2c9caa0cd604d394` |
| `digger.html` | 10,223 | `382fbf75ab5bfff6e01b023f041969e36f0f3d988eaab24db4fe2de5926f720b` |
| `digger-build-info.js` | 308 | `bf2d575c2422c8c429688b57bec41ce0609e4fc811439263ea6c48e588235886` |

The website package revision is `e85cab1164f0-b7e87a0852`. Its exact corresponding-source archive is 676,316 bytes with SHA-256 `60661381ad0e3a31e039ef65c1e92bfd4c5ad5e8fef666d203f8d3bf4af76af3`.

## Release-gate evidence

The known graphics, font, title, icon, levels, and tune-table blockers are replaced or compiled out. `docs/digger-data-audit.md` records the completed source-by-source audit of remaining static initializers. The current colored geometric sprites distinguish the player, emeralds, terrain, enemies, lives, and the transition into the second level. Levels 3–8 have not received full playthroughs.

Muted Chromium testing completed the generated first level: two short Right taps moved the player into the only emerald, raised the score to 25, and visibly transitioned to the second replacement level. A longer second-level run showed enemy movement, loss of one life, and a clean restart. Browser diagnostics contained no SDL sound-device initialization after the compiled-quiet fix.

The IDBFS mount was tested by writing a sentinel through the runtime filesystem, flushing it, reloading the page, and reading the same bytes back. The sentinel was then deleted and the deletion flushed. The packaged build passed the real Decomp Games player flow locally and at `play.decompgames.com`: delayed download, muted launch, first-level completion, second-level rendering, save-backup export, and Stop game. The backup was correctly namespaced as `digger` / `replacement-v1`; it contained no files before the game wrote a score or preference. High-score entry itself remains unverified and is not claimed. Audio is intentionally absent in this variant.
