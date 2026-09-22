# Digger replacement-build integration

Status: internal experiment, not publishable and not counted toward the five-game milestone.

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
| `digger.js` | 372,900 | `8f7cb2d4d765d66554bbd4ed15d0c1325a783c3d160ae3796be73287bf44fd33` |
| `digger.wasm` | 4,887,636 | `5fc4ce1a3d779511625edb8055f61ad604338a3eb726b614ed04baafcaeef063` |
| `digger.html` | 9,287 | `bee8f80b8f9fdd1d39ba66770159944d4e1f440de1b732901244c91f016bda14` |
| `digger-build-info.js` | 308 | `bf2d575c2422c8c429688b57bec41ce0609e4fc811439263ea6c48e588235886` |

## Distribution blockers

The known graphics, font, title, icon, levels, and tune-table blockers are replaced or compiled out. `docs/digger-data-audit.md` records the completed source-by-source audit of remaining static initializers. The current colored geometric sprites are readable enough to distinguish the player, emerald, terrain, and level transition during the opening verification path, but levels 2–8 still need broader readability and interaction testing.

Muted Chromium testing completed the generated first level: two short Right taps moved the player into the only emerald, raised the score to 25, and visibly transitioned to the second replacement level. Browser diagnostics contained no SDL sound-device initialization after the compiled-quiet fix. This establishes launch, input, collection, scoring, and one complete level loop. Death/restart, levels 2–8, high-score persistence, and website player integration remain unverified. Audio is intentionally absent in this variant.
