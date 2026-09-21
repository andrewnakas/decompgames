# A Link to the Past: experimental WebAssembly engine

September 21, 2026 UTC: compilation passed. No browser launch or gameplay test, no public runtime, and no game data bundled. This is a port experiment, not another playable catalog title.

## Source and licensing

[snesrev/zelda3](https://github.com/snesrev/zelda3/tree/fbbb3f967a51fafe642e6140d0753979e73b4090), revision `fbbb3f967a51fafe642e6140d0753979e73b4090`, reconstructs the game logic in C. It retains LakeSnes-derived PPU/DSP components and has optional comparison emulation; preserve that distinction in descriptions. LICENSE.txt provides MIT terms and bundled Opus BSD notices. Nintendo assets have separate rights and are excluded.

Upstream extraction requires the supported US ROM, SHA-256 `66871d66be19ad2c34c927d6b14cd8eb6fc3181965b6e517cb361f7316009cfb`, to produce `zelda3_assets.dat`. No ROM or extracted data was fetched for this work.

## Reproduction and evidence

Activate Emscripten 4.0.10 on Linux, clone upstream at the exact revision, then run from this website repository:

```sh
python3 scripts/build-zelda3-browser.py /path/to/zelda3 /path/to/zelda3-browser
```

The script verifies the revision and tracked engine changes, generates patched copies without changing upstream files, and writes flags, sizes, and hashes to `build-record.json`. It replaces two SDL_Delay calls with Emscripten sleeps, enables Asyncify, SDL2, filesystem/IDBFS, memory growth, and exit notification, and disables the platform volume mixer. Nothing is preloaded.

The first compile exposed mismatched calls to the zero-argument `ppu_init`. Correcting the extra arguments in two generated sources removed those WASM linker warnings. The final build succeeded, with an upstream `VWF_RenderSingle` declaration/prototype warning still requiring review.

| Output | Bytes | SHA-256 |
| --- | ---: | --- |
| zelda3.js | 199672 | `457283f5c77ce863562376165d5222aa16046058d7c57531cdda2323a24f5310` |
| zelda3.wasm | 2224972 | `04dd1e9462458d87cb91acdfebc345ce6f7ce86f1eaab6e9acd9cf5292f6c6ab` |

Artifacts remain local. Before distribution, package the exact corresponding source archive, generated patches, recipe, dependency notices, toolchain record, and manifest checksums.

## Adapter backlog

1. Import local `zelda3_assets.dat`. Validate the 48-byte signature, asset count, header/table bounds, aligned asset ranges, and a size ceiling against the pinned engine. Never upload the file.
2. Place assets in the working directory and persist its `saves/` directory. Upstream uses `saves/save%d.sav`, `saves/sram.dat`, and `saves/sram.bak`; confirm actual behavior before claiming persistence.
3. Choose a browser-compatible renderer and launch with the shared muted audio gate. Check timing and input polling rather than assuming existing engine patches apply.
4. Test representative gameplay, save/reload, backup round trip, invalid imports, and network privacy using legitimately supplied data. Audio stays muted and unverified; stop test players afterward.
5. Publish a Play with your files action only after adapter and runtime release gates pass.

## Additional lead

[Fire & Forget II reconstruction](https://github.com/n0isy/fire-and-forget-2-recomp/tree/e680ed2ed1f42f663bc9c1896a1742a39cebfda6) contains SDL2 C code and a WASM build script. The inspected revision has no clear engine license grant. Educational/preservation wording and dependency licenses do not license the implementation. Keep this research-only pending an explicit engine license and separate original-data review.
