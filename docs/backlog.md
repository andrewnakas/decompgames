# Persistent expansion backlog

## Current release gate

- [ ] Eight complete instant-play games with documented gameplay/audio/save checks.
- [ ] Two local-file integrations with end-to-end import and no-upload verification.
- [x] Thirty catalog records with individual routes and explicit test scope.
- [ ] Public GitHub source, matching binary source archives, notices, deployment, and rollback checks.

## Finish before broad expansion

1. Finish Open Cadet high-score/input tests and restrict its preload to replacement assets only.
2. Verify Freedoom save/reload and local Doom import using freely redistributable test data.
3. Test the less-restrictive Asyncify OpenTyrian rebuild through menu transitions and saves.
4. Test OpenTTD with OpenGFX/OpenSFX; keep missing browser music support explicit.
5. Verify ScummVM support data, intro skips, gameplay input, and saves for BASS, Lure, Queen, and Sołtys.
6. Test Quake with locally supplied compatible data. Do not publish commercial PAK files.

## Next integrations

- ScummVM freeware: Dráscula, DreamWeb, Sfinx, The Griffon Legend; then God of Thunder and other current freeware candidates. Review each engine and data license separately.
- Local adapters: OpenLara, RigelEngine, OpenRCT2, OpenJazz.
- Consider additional open-data games on existing runtimes only when they are genuinely distinct games. Do not count editions, demos, or repeated engine builds as extra games.

## Discovery coverage to research

- decomp.dev and its upstream directory; preserve progress-vs-playability distinctions.
- Reverse engineering and source-port indexes, then primary source repositories.
- ScummVM supported engine/game tables and authorized freeware collection.
- Doom/Quake source-derived games, released-source strategy games, and independently licensed data sets.
- Recompilation projects and console decompilation projects with substantial upstream documentation.
- Candidate engine recreations: OpenRA, OpenXcom, OpenMW, DevilutionX, Exult, GemRB, FreeSpace Open, DXX-Rebirth, The Force Engine, OpenJK, OpenTESArena, OpenNox, OpenOMF, REminiscence, RE2/RE3 projects only after provenance review.

## Per-pass procedure

Deduplicate by original game and record project variants as related sources. Find primary documentation, inspect exact license files, explain required data and supported editions, and write original setup guidance. Only add a record when the evidence supports its technical category. Add runtime work in small, testable changes. Keep unsuccessful tests in the log rather than erasing them. Recheck changed licenses before hosting a new revision.

The hourly follow-up is configured in Codex as `Expand Decomp Games`. It should notify only for meaningful releases, failures, completion, or needed user action.
