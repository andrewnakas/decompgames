# Actual decompilation priority — September 20, 2026

The user requested actual decompiled games instead of additional ScummVM work. The hourly task and AGENTS.md now preserve that priority. No existing recreation is relabeled to inflate decompilation coverage.

## Supaplex / OpenSupaplex

Reviewed revision `bad56a4e174e628643995284ea55d4c49af3137c` of [sergiou87/open-supaplex](https://github.com/sergiou87/open-supaplex/tree/bad56a4e174e628643995284ea55d4c49af3137c).

- [README](https://github.com/sergiou87/open-supaplex/blob/bad56a4e174e628643995284ea55d4c49af3137c/README.md) links its disassembled assembly ancestry and describes the C translation. `src/supaplex.c` retains original assembly references. This is the basis for classifying it as decompilation-derived, not just its visual similarity.
- [Source header](https://github.com/sergiou87/open-supaplex/blob/bad56a4e174e628643995284ea55d4c49af3137c/src/supaplex.c) specifies GPL version 3, without an “or later” clause. README distinguishes MIT disassembly from the GPL C implementation.
- [WebAssembly recipe](https://github.com/sergiou87/open-supaplex/blob/bad56a4e174e628643995284ea55d4c49af3137c/wasm/Makefile) uses SDL2, SDL2_mixer, memory growth, and preloads the entire resources directory.
- Local baseline build succeeded with Emscripten 4.0.10: `make -C wasm -j2` after checking out the exact revision. This proves compilation only. Nothing from this build has been uploaded or advertised as playable.
- The local WASM is 1,557,519 bytes, SHA-256 `13b7938e5aa24e85826ed6ccfc85d0bc01422efa5d4e191d76656ebe9350dba7`. `scripts/build-supaplex-baseline.sh` records the revision/toolchain checks and baseline build command. The upstream recipe also produces a 9,006,817-byte bundled data file; it remains local pending the asset audit.
- Upstream describes original data as freeware, but the resources also contain contributed level sets and audio. Record each component's permission before hosted distribution; a local-file adapter remains an option. The repository's presence of assets alone is not sufficient provenance.

Next steps: audit the browser event loop/yielding; separate resource loading from engine code; identify writable player/config/snapshot files; mount those in the site's save namespace; add bounded local-file selection if permissions remain unclear; test movement, one puzzle, death/restart, and progress reload silently. The baseline recipe has no site save integration.

### Experimental data-free engine build

`scripts/build-supaplex-browser.py` now successfully compiles the pinned C source with Emscripten 4.0.10, SDL2/mixer and Asyncify. The recipe rejects a different revision or tracked source edits, generates a separate patched system file, and does not modify upstream source files or preload resources.

The patch yields with `emscripten_sleep(1)` in event polling and uses `emscripten_sleep(time)` for delays. This is a proposed browser scheduling adaptation, not a verified timing fix. Upstream's FHS/XDG file abstraction separates read-only `/games/supaplex` from writable `$HOME/.local/share/OpenSupaplex` (or `$XDG_DATA_HOME/OpenSupaplex`). Leave `OPENSUPAPLEX_PATH` unset because it bypasses that split. Writable callers include SUPAPLEX.CFG, player and hall-of-fame lists, level-list state, snapshots, and config files. A site manifest must mount and restore the actual writable directory before starting the engine.

Local output: `/home/nakas/decompgames-build/supaplex-browser`.

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| supaplex.js | 198952 | 6d82bc3fc8ed8e7965901c629c3e0e88421605993fe09b9323164a6d244d04b1 |
| supaplex.wasm | 1541793 | d5b31863a26b3b1b33686f7e7086016df9078144ef4d0e246e33ab68ad07424a |
| system-browser.c | 3834 | 429d9e2e14ce8f6b7f61f7bc592fd0eab8f78bca7fab787468ee7a9534adb651 |

No runtime or data was published. Next is a muted local browser harness using the shared audio gate, input and save tests, asset permission review or a validated local-import adapter, and an exact corresponding source archive before any binary release. No browser was launched during this build-only pass.

## OutRun / CannonBall

Reviewed revision `27493ebf62be3498dff93ed6a45e8e2db819bae1` of [djyt/cannonball](https://github.com/djyt/cannonball/tree/27493ebf62be3498dff93ed6a45e8e2db819bae1).

- [README](https://github.com/djyt/cannonball/blob/27493ebf62be3498dff93ed6a45e8e2db819bae1/README.md) states that original 68000/Z80 assembly was rewritten in C++. Categorized as decompilation-derived rather than emulation.
- [Actual license](https://github.com/djyt/cannonball/blob/27493ebf62be3498dff93ed6a45e8e2db819bae1/docs/license.txt) prohibits commercial use and requires source for modified redistributions. It is not GPL and does not satisfy the site's open-source hosting policy. Keep discovery-only.
- [ROM list](https://github.com/djyt/cannonball/blob/27493ebf62be3498dff93ed6a45e8e2db819bae1/roms/roms.txt) specifies Revision B, with distinct optional Japanese-track files. No ROMs were downloaded or distributed.

## Search coverage and deduplication

Searched upstream decompilation/WebAssembly candidates and inspected exact source files for these two additions. Also surfaced CSE2, SM64, and TRX: SM64 already has a catalog entry; TRX must be represented as another project for the existing Tomb Raider entry rather than duplicating that game; CSE2 still needs a separate provenance/license review. This is a bounded search pass, not exhaustive coverage.

No game was promoted to browser verified. ScummVM expansion is paused, with the partial Lure test retained in the test log.
