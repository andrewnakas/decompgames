# Digger replacement-build data audit

Audit scope: the object list compiled by `GNUmakefile` for `ARCH=WASM` at pinned revision `e85cab1164f0304b3e66f371a5997d83f7a0090a`. Test programs, the unused FreeBSD video and keyboard backends, and the two native network objects filtered from the WASM build are outside the artifact and outside this audit.

## Replaced or excluded data

| Upstream data | Treatment in the replacement build |
| --- | --- |
| `game.c` level initializer | Replaced with the CC0 output of `generate-open-digger-levels.mjs`. |
| `cgagrafx.c`, `vgagrafx.c` | Replaced with independently generated CC0-format tables. Only symbol names, byte lengths, and pointer-table order are treated as engine interface facts. |
| `alpha.c` | Replaced with an independently defined compact glyph set. |
| `title_gz.c`, `icon.c` | Replaced with independently generated CC0 title and icon data. |
| Music and jingle tables in `sound_backend.c` | Excluded by removing `_SDL_SOUND`; preprocessing selects the file's empty no-audio stubs. |
| Upstream shell title and subtitle | Replaced with replacement-build branding. Sound controls are removed. |

## Remaining compiled initializers

The remaining initialized tables contain executable behavior or interface metadata rather than audiovisual or level content:

- `bags.c`: four-step wobble state sequence.
- `digger.c`: death-arc offsets and emerald collision-box dimensions.
- `drawing.c`: bit masks used while modifying the playfield buffer.
- `sprite.c`: first and last sprite indices for collision groups.
- `input.c`: key state, direction state, input-source state, and pointer lists.
- `sdl_kbd.c` and `keyboard.c`: SDL scan-code defaults and human-readable control names.
- `scores.c`: zero-initialized score state.
- `main.c`: supported display-mode metadata and the upstream copyright notice, which is retained as attribution.

`newsnd.c`, `sdl_snd.c`, `soundgen.c`, and `spinlock.c` remain link dependencies for the upstream no-audio stubs and device interface. The build makes quiet mode the compiled default, removes `_SDL_SOUND`, and forces `/Q`; no note, melody, sample, or recorded-audio table remains in the compiled branch. Browser diagnostics must confirm that the SDL audio device is not initialized before release.

No other compiled C source at this revision contains a static initializer representing graphics, fonts, maps, title art, icons, melodies, samples, narrative text, or other game content. This is a source audit of the pinned build recipe, not a general legal opinion or a claim about unbuilt upstream files.
