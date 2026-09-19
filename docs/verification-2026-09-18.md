# Browser integration test log — September 18, 2026

Environment: Windows, Chromium-based Codex in-app browser, local production build.
This is a development record, not cross-browser certification or a completed playthrough.

| Integration | Observed | Still required |
| --- | --- | --- |
| Open Cadet | Table renders with replacement assets | Representative play, audible sound, high-score persistence |
| Freedoom Phase 2 | Attract demo, new-game menu, level start, keyboard firing, save menu | Save/reload, backup round trip, audible audio, normal-browser mouse capture |
| OpenTyrian | Game data loads, attract-mode rendering and SDL audio initialization | Input/menu transition under investigation; save/reload and audible audio |
| OpenTTD | WebAssembly compiled | Browser start, controls, transport gameplay, save/reload |
| ScummVM titles | Four-engine build compiled | Per-title runtime data and save validation |
| Doom / Quake imports | Header/bounds/duplicate-file validation tests pass | End-to-end local import, gameplay, saves, network inspection |

Freedoom reports a pointer-lock limitation inside the in-app browser. This does not establish compatibility or incompatibility in standalone Chrome, Edge, Firefox, or Safari.

Automated tests cover malformed/truncated WAD/PAK input, directory bounds, missing base IWAD, duplicate names, and backup path/version validation. No commercial game data is included in the repository.
