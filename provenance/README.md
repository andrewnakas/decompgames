# Source and asset provenance

`assets.json` records exact download origins, byte sizes, and SHA-256 hashes. Runtime manifests record source revisions, toolchains, binary hashes, and corresponding source archives. Hashes establish identity, not distribution permission.

## Distributed data

- Open Cadet: `andrewnakas/open-cadet`, revision `4ae332be705f86bfb62f8d8ac1dc1f11918977dd`, original replacement data under CC0. Engine: MIT-licensed alula SpaceCadetPinball fork. Do not include Microsoft original data.
- Freedoom 0.13.0: BSD-3-Clause data. Retain `COPYING` and `CREDITS` alongside WADs. The current player selects Phase 2.
- OpenTyrian: Tyrian 2.1 freeware archive linked by the upstream OpenTyrian README. Original data remains separately licensed; the GPL engine is not the data license. Retain the original archive notices. [Upstream data instructions](https://github.com/opentyrian/opentyrian#game-data).
- OpenTTD: free base sets OpenGFX 8.0, OpenSFX 1.0.3, and OpenMSX 0.4.2. Original tar archives retain their copyright and license files. Check each release’s license rather than assuming all three match.
- BASS and Lure: Revolution Software freeware grants in the original archive notices. BASS package is the floppy edition.
- Flight of the Amazon Queen and Sołtys: original freeware notices retained in their data directories. [ScummVM authorized collection](https://www.scummvm.org/games/).
- ScummVM `sky.cpt` and `lure.dat`: pinned engine support data from the matching ScummVM source tree; distributed with its corresponding source archive and license.

## Catalog artwork

The four initial screenshots were copied from the creator’s ExeBrowser repository. Open Cadet depicts CC0 replacement artwork; Freedoom depicts BSD-licensed data; OpenTTD depicts its free base graphics. BASS depicts the Revolution freeware release. These images are illustrative upstream screenshots, not proof of browser testing on this site. No proprietary box art is used for other entries.

## Source archives

Each archive contains the exact upstream tree, `decompgames.patch`, build instructions, and the platform’s engine build scripts. Apply the patch before building. Third-party notices already in the upstream source must remain intact. Publish archives before exposing their matching binaries. Native or Emscripten dependency versions and their licenses must also be recorded before the public release gate passes.
