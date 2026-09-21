# Replacement-data priority — September 21

The user now prioritizes playable decomps using independently created replacement assets. Pause further Zelda import expansion after preserving its experimental adapter. Do not describe freeware, a permissively licensed engine, or a partial texture replacement as a complete clean-room asset pack.

## Current evidence and decisions

- **Open Cadet:** primary repository https://github.com/andrewnakas/open-cadet documents CC0 replacement game data for the MIT pinball engine. Already integrated; finish gameplay/high-score checks rather than counting another game.
- **OpenSupaplex:** https://github.com/sergiou87/open-supaplex documents the reverse-engineering project. Our data-free WASM build has local movement/profile evidence. The upstream resource folder contains original graphics, music, demos, and many level packs; do not relabel those as independently created. Best current target for authoring a new complete pack.
- **Digger Remastered:** https://www.digger.org/faq.html discusses permission from the original author and GPL licensing. Worth a separate rights review as authorized content, but this is not evidence of independently authored replacement assets and does not satisfy the stronger requirement by itself.
- **Zelda3:** engine and asset-file validator are experimental. No complete independently created asset pack identified. Do not prioritize it for instant play or fetch proprietary data.

## Supaplex replacement pack prototype

`node scripts/generate-open-puzzles.mjs` creates six original navigation layouts and a checksum manifest in `.cache/open-puzzles`. The generator reads no original level, image, or audio files and uses no network. Generated level data is dedicated under CC0-1.0 (https://creativecommons.org/publicdomain/zero/1.0/); the generator follows the platform source license.

Only the documented engine format is used: 60 by 24 tiles, a 1536-byte record, and a 23-byte name at offset 1446, as declared in `src/globals.h` of OpenSupaplex revision `bad56a4e174e628643995284ea55d4c49af3137c`. Each prototype has one player, one exit, enclosing walls, no hazards or required collectibles, and a statically checked path to the exit. This proves graph reachability, not completion in the engine.

These are six navigation prototypes, not six games, a complete campaign, or a playable replacement release. Do not pad the engine's 111-level menu with duplicates and call that full content.

Remaining work:

1. Add a small-campaign mode or explicit standalone-level launch to the pinned engine.
2. Create original UI, readable font, tile/sprite animations, palettes, title/panel art, and sound data or an explicit silent configuration. Audit every required file; exclude bundled original demos and music.
3. Extend levels with carefully tested mechanics and authored solutions, then verify completion and saved progress while muted.
4. Publish per-file provenance, editable sources, licenses, reproducible packaging, exact engine source, and test evidence before adding instant play.

Use “independently authored replacement assets” where supported. A formal clean-room development process is not established merely by generating files or assigning a license.
