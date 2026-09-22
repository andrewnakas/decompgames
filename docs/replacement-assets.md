# Replacement-data priority — September 21

The user now prioritizes playable decomps using independently created replacement assets. Pause further Zelda import expansion after preserving its experimental adapter. Do not describe freeware, a permissively licensed engine, or a partial texture replacement as a complete clean-room asset pack.

## Current evidence and decisions

- **Open Cadet:** primary repository https://github.com/andrewnakas/open-cadet documents CC0 replacement game data for the MIT pinball engine. Already integrated; finish gameplay/high-score checks rather than counting another game.
- **OpenSupaplex:** https://github.com/sergiou87/open-supaplex documents the reverse-engineering project. Our data-free WASM build has local movement/profile evidence. The upstream resource folder contains original graphics, music, demos, and many level packs; do not relabel those as independently created. Best current target for authoring a new complete pack.
- **Digger Remastered:** https://www.digger.org/faq.html discusses permission from the original author and GPL licensing. Worth a separate rights review as authorized content, but this is not evidence of independently authored replacement assets and does not satisfy the stronger requirement by itself.
- **Zelda3:** engine and asset-file validator are experimental. No complete independently created asset pack identified. Do not prioritize it for instant play or fetch proprietary data.

## Open Paths replacement pack

`node scripts/generate-open-puzzles.mjs` creates six original navigation layouts and a checksum manifest in `.cache/open-puzzles`. The generator reads no original level, image, or audio files and uses no network. Generated level data is dedicated under CC0-1.0 (https://creativecommons.org/publicdomain/zero/1.0/); the generator follows the platform source license.

Only the documented engine format is used: 60 by 24 tiles, a 1536-byte record, and a 23-byte name at offset 1446, as declared in `src/globals.h` of OpenSupaplex revision `bad56a4e174e628643995284ea55d4c49af3137c`. Each prototype has one player, one exit, enclosing walls, no hazards or required collectibles, and a statically checked path to the exit. This proves graph reachability, not completion in the engine.

These are one six-level navigation campaign, never six games. The first two-step level is the deterministic release-gate loop; levels two through six are perfect mazes. The package does not pad the engine's menu with duplicates.

Release result:

The complete 14-file allowlist was published as immutable package `bad56a4e174e-026301f2dd`. Its engine uses a null audio backend, and the corresponding-source archive contains the exact pinned source, patches, build record, generators, codec, manifest, and build instructions. Muted local and production testing passed title/menu input, player creation, movement, first-level completion, fresh-start progress, backup export, deletion, import, and restored progress. The full six-level playthrough remains unverified.

Historical implementation checklist:

September 21 asset-tool pass: `scripts/generate-open-font.mjs` now generates both 512-byte font files from original geometric glyph definitions (ASCII 32–95) and an SVG preview. `scripts/generate-open-tiles.mjs` generates a 5120-byte FIXED.DAT with original static artwork for tile IDs 0–7, including a rover character, substrate, gateway, and collectible. Other tiles are explicitly diagnostic crosses. Previews use a proposed palette, not a tested game palette. Both generators read no game assets and dedicate generated data under CC0-1.0. Their manifests include hashes and `engineTested: false`.

The planar codec in `scripts/lib/supaplex-planar.mjs` follows the pinned engine's row/plane layout. Tests compare its output against independently calculated byte values, including distinct row planes and invalid inputs; all 23 repository tests pass. At that stage, fonts, sprites, palette, and menu readability still needed integration and visual testing; the release result above records their later integration.

Generated hashes:

- CHARS6.DAT: `f1ad9b07226ad98a27fec6f26182b15dde71fb73625660876887c60fe0ad37df`
- CHARS8.DAT: `dfd95456760956a194fd31dd599f7074f1f98b12654a22557351cb186658243c`
- FIXED.DAT: `224f4466813e9798dd15364e0486727528729ccc3294046711cf22482d0af4ef`

1. Completed: supply a six-level campaign without duplicating levels.
2. Completed: create original UI, readable fonts, tile/sprite frames, palettes, title/panel art, and a null-audio configuration; exclude bundled original demos and music.
3. Completed for the release gate: verify first-level completion and saved progress while muted. Full-campaign verification remains open.
4. Completed: publish per-file provenance, source generators, licenses, reproducible packaging, exact engine source, and test evidence.

Use “independently authored replacement assets” where supported. A formal clean-room development process is not established merely by generating files or assigning a license.
