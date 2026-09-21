# Digger replacement-build integration

Status: internal experiment, not publishable and not counted toward the five-game milestone.

## Pinned engine and browser build

- Upstream: https://github.com/sobomax/digger
- Revision: `e85cab1164f0304b3e66f371a5997d83f7a0090a`
- Toolchain: Emscripten 6.0.1 at `25e4e8d6550d392ba9e0c2936bce7cf41ee47cc0`
- Upstream already provides an SDL2/WebAssembly target with Asyncify.

`scripts/generate-open-digger-levels.mjs` creates eight 15×10 layouts without reading original maps. The generated `open-levels.inc` is CC0-1.0, 1,778 bytes, SHA-256 `9f3740519bdd469e9f2ea39003a5043776b79fdfbc9a5666e2fbf484b2f8340b`. The layouts pass structural dimension and alphabet validation but have not been played or proven completable.

`scripts/generate-open-digger-graphics.py` generates replacement CGA and VGA tables, a title, and an icon from new geometric definitions. `scripts/generate-open-digger-font.py` generates the font from a compact independent glyph map. The scripts read the pinned C files only for symbol names, array lengths, and pointer-table order; they do not reuse initializer values. The CC0 output records are:

| Generated source | Bytes | SHA-256 |
| --- | ---: | --- |
| `cgagrafx.c` | 66,210 | `d1f4c0b354ca6649561d8f91fa8792f262276d30c8514a8e9286d65afc1bf900` |
| `vgagrafx.c` | 859,537 | `b09cfcf39b9fafa968b84cd8e3d9e1aece93a7ef8602e552eb8e4ff3564595f5` |
| `title_gz.c` | 4,913 | `8312f5e3e9e183d1693ea99d68b062e030c3ea961ae25c6bf7457774da5b1a2a` |
| `icon.c` | 61,510 | `5e53e0dedf75ed5a63016bbd5abb3d6f4bffe62852d8298ce5654f08855c51ac` |
| `alpha.c` | 127,269 | `8bebe6c24b2638f7227373e3b7d81a1556dbe79650185717f82f4fe774d43b80` |

`scripts/build-digger-browser.py` checks the exact source revision, refuses a dirty checkout, validates the replacement manifests, and builds in a copied source tree. It removes `_SDL_SOUND`, which selects upstream's no-audio branches and preprocesses the upstream tune tables out of the WASM. The shell also forces `/Q`, uses replacement-build branding, and omits sound controls. The current successful internal build produced:

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| `digger.js` | 381,140 | `c1fb4d9baca4981d1eb86b04875bf99ab4d2239eaf5ae26deb869ebfcd9f6865` |
| `digger.wasm` | 5,352,443 | `89d95bba4a76ba15f061151f1c32a7b3363eff9ccaa0eb3e8dccb0a727d864fc` |
| `digger.html` | 9,287 | `bee8f80b8f9fdd1d39ba66770159944d4e1f440de1b732901244c91f016bda14` |
| `digger-build-info.js` | 308 | `bf2d575c2422c8c429688b57bec41ce0609e4fc811439263ea6c48e588235886` |

## Distribution blockers

The known graphics, font, title, icon, levels, and tune-table blockers are now replaced or compiled out. A source-by-source audit of the remaining static initializers is still required before distribution. The current colored geometric sprites are useful for format and input testing but need a complete-level readability test before they can qualify as finished replacement assets.

Muted browser testing has reached the generated first level and observed directional input with the replacement visuals and font. It has not established representative interactions, death/restart, a completed level, or persistence. Audio is intentionally absent in this variant and no audible test is planned under the user's silent-testing instruction.
