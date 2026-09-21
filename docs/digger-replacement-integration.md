# Digger replacement-build integration

Status: internal experiment, not publishable and not counted toward the five-game milestone.

## Pinned engine and browser build

- Upstream: https://github.com/sobomax/digger
- Revision: `e85cab1164f0304b3e66f371a5997d83f7a0090a`
- Toolchain: Emscripten 4.0.10 at `b7dc6e5747465580df5984e723b9d1f10d8e804b`
- Upstream already provides an SDL2/WebAssembly target with Asyncify.

`scripts/generate-open-digger-levels.mjs` creates eight 15×10 layouts without reading original maps. The generated `open-levels.inc` is CC0-1.0, 1,778 bytes, SHA-256 `9f3740519bdd469e9f2ea39003a5043776b79fdfbc9a5666e2fbf484b2f8340b`. The layouts pass structural dimension and alphabet validation but have not been played or proven completable.

`scripts/build-digger-browser.py` checks the exact source revision, refuses a dirty checkout, builds in a copied source tree, replaces only the built-in level initializer, and writes a build record. The successful experimental build produced:

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| `digger.js` | 390,593 | `ac944a30b4ba0a50ea5cd460c6faa257cb41aecd008c599b67bc5e3e8b59c732` |
| `digger.wasm` | 5,304,758 | `4761c3431fa94045d6517a5e33dcd49da78f565273df65633264774b27975967` |
| `digger.html` | 9,403 | `1bd66246b396b4a990535051dfb1d5bfb41a32566ca9f65054e09fa0e9f70741` |
| `digger-build-info.js` | 308 | `bf2d575c2422c8c429688b57bec41ce0609e4fc811439263ea6c48e588235886` |

## Distribution blockers

The compiled binary still embeds upstream `cgagrafx.c`, `vgagrafx.c`, `title_gz.c`, and `icon.c`. Those are treated as original audiovisual data regardless of the remaster's code license. The experiment cannot be uploaded, described as clean-room, or counted as playable until independently authored replacements cover those files and a remaining-data audit passes.

After that asset work, muted browser testing must cover launch, input, representative play, death/restart, a completed level, persistence, and failure paths. Audio remains unverified under the user's silent-testing instruction.
