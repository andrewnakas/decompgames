# Tube replacement-only feasibility

Pinned upstream revision: [`d2c74cdbb82fedacc528f651ef28820bd186e0d2`](https://github.com/rep-stosw/tube-game-dos/tree/d2c74cdbb82fedacc528f651ef28820bd186e0d2). Upstream describes recreating the 1994 DOS game's source with Hex-Rays and IDA, provides GPL-2.0 code, and documents an Emscripten build. This makes it a documented decompilation candidate, **not** a hosted or verified Decomp Games release.

The upstream `TubePCWEB/build_web.bat` copies `bin/DSEG3.bin`, `DSEG4.bin`, the entire `DATA/` directory, and sound data into `asset/`, then embeds that folder with `--preload-file`. Its committed `index.js` lists about 2.0 MB of packaged data. These files must never be carried into our public runtime merely because the source repository is GPL-2.0. The independent asset pack has not been made.

| Input boundary | Observed evidence | Replacement task |
| --- | --- | --- |
| `DSEG3.bin` (624,880 bytes), `DSEG4.bin` (1,296 bytes) | `Game/misc.cpp::LoadDSEG` loads both as memory segments; `DSEG3.h` maps variables, pointers, graphics and animation tables into the first segment | Inventory byte ranges and initialization semantics; generate clean independent data without copying original embedded presentation or level data. This is the largest blocker. |
| `DATA/LEV00000.DAT` through `LEV00003.DAT` (66,136 bytes each) | Packaged by the web build | Document the level format and author a complete playable set independently. |
| `DATA/TEX00.DAT`, `TEX01.DAT`, `TUNNEL.DAT`, `BLOCKS.DAT`, `GLASS.DAT`, `LOGO.DAT` and palette/tables | Packaged by the web build; textures are 65,536 bytes each and the tunnel and blocks files 131,072 bytes each | Trace the loaders, then draw and encode complete replacement visuals and supporting tables. |
| `SOUND/` banks and `.DAT`/`.TAB` files | `Sound/SB16.cpp` and `Music/HMP.cpp` load these files | Keep a null audio backend for silent development; do not bundle original sound or music. Verify that missing files cannot block gameplay. |

The current repository is a useful source and format reference, but a release cannot use its checked-in binary, `index.data`, screenshots, or game data. Next technical step: map every data loader and the `DSEG3` layout before attempting an asset generator. A compile using upstream packaged data is not a replacement-only milestone and should not be reported as playability progress. The related `tube64` targets the same game and cannot count as a separate title.
