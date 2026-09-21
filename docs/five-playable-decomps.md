# Five additional playable decomps

User confirmed September 21: strictly decompiled games with independent replacement assets. Released-source games, ordinary emulation, existing hosted games, asset prototypes, and alternate editions do not satisfy this milestone.

**Completed additions: 0 / 5.** No new playable release was deployed during this pass.

Each counted addition needs documented decompilation provenance, an open-source engine license, a complete independently authored asset package, exact source/build/checksum records, deployment, and muted launch/input/representative gameplay/save verification. Full-game content availability and full-playthrough verification remain separate claims. Audio remains unverified.

## Candidate findings

| Candidate | Evidence | Current decision |
| --- | --- | --- |
| Supaplex / OpenSupaplex | Pinned GPL decompilation already builds to WASM; movement and profile persistence observed using earlier local data | First replacement-pack target. New levels, fonts, static tiles, screens and palette are prototypes. Moving animations and integration remain. |
| Prince of Persia / SDLPoP | https://github.com/NagyD/SDLPoP describes its DOS disassembly basis and GPL code | Eligible engine lead, not a ready addition. No complete independent graphics/levels/music pack established. Do not assume repository data shares the engine license. |
| Digger Remastered | https://github.com/sobomax/digger and https://www.digger.org/faq.html document remaster/source rights | Potential independent-data authoring target. Original author permission is not replacement-asset provenance. Needs file-level review and port work. |
| SkiFree | https://github.com/yuv422/skifree_decomp reconstructs C code; https://github.com/jeff-1amstudios/skifree_sdl ports it | No clear engine open-source grant established in inspected material. Excluded from hosting pending evidence; replacement pictures alone would not resolve this. |
| Zelda3 | Pinned engine and local-DAT validator exist | No independent full asset pack identified. Hold behind smaller candidates. |
| Bermuda Syndrome / Heart of Darkness | https://github.com/cyxx/bermuda and https://github.com/cyxx/hode describe engine reimplementations | Not accepted into the strict-decomp milestone without stronger provenance; no full replacement packs established. |
| LibreQuake / Blasphemer | https://github.com/lavenderdotpet/LibreQuake and https://github.com/Blasphemer/blasphemer offer free replacement content | Excluded from this milestone because their released-source engines do not meet the user's strict-decomp choice. |

This is a research queue, not five promised or verified releases. Continue searching smaller documented C/SDL decomps and recording license/data blockers. Do not invent an eligible fifth project to fill a table.

## Current Supaplex artifact step

`node scripts/generate-open-screens.mjs` generates new MENU/BACK/CONTROLS/GFX/TITLE/TITLE1/TITLE2/PANEL data and four palettes, using only our generated font. Menu labels align with the pinned engine's button regions. Output includes per-file checksums and vector previews. Screen file lengths match the loaders (32000 bytes for full screens; 3840 for panel; 256 for palettes), but rendering is not yet tested. Engine title palettes are hardcoded and need explicit replacement in a source patch.

Next: finish animation assets and a bounded campaign, assemble a replacement-only package, verify no original asset file is loaded, then test completion/save restoration and publish the first qualifying addition. No unsafe shortcut is implied by the five-game target.
