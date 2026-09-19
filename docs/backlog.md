# Persistent expansion backlog

## Current release gate

- [ ] Eight complete instant-play games with documented gameplay/audio/save checks.
- [ ] Two local-file integrations with end-to-end import and no-upload verification.
- [x] Thirty catalog records with individual routes and explicit test scope.
- [ ] Public GitHub source, matching binary source archives, notices, deployment, and rollback checks.

## Finish before broad expansion

1. Finish Open Cadet high-score/input tests. Its published preload is now restricted to replacement DAT/WAV assets.
2. Freedoom save/reload and backup export/import passed on September 19; finish audible audio, mouse capture, and representative gameplay checks. Doom local import boots with a free Freedoom IWAD; its own save and network checks remain.
3. OpenTyrian's unrestricted Asyncify rebuild reached the first mission and a named save slot. Investigate the intermittent black screen on a later menu transition, then verify in-game reload, sustained controls, and audio. Backup files export both before and after restart.
4. Test OpenTTD with OpenGFX/OpenSFX; keep missing browser music support explicit.
5. Verify ScummVM support data, intro skips, gameplay input, and saves for BASS, Lure, Queen, and Sołtys.
6. Test Quake with locally supplied compatible data. Do not publish commercial PAK files.
7. Make backup replacement recover from write failures and coordinate mutations with running engine writes; check large saves against the current 8 MiB import limit.

### September 19 persistence pass

The live Freedoom save and backup round trip passed with distinct pre-import and post-import ammunition counts. Added regression coverage for conflicting backup paths and size/count limits. Fixed `fetch:games` so a fresh clone retrieves the pinned asset tree instead of requiring an untracked local cache. No new catalog entries or coverage claims were added during this integration pass.

### September 19 OpenTyrian / loading pass

Tested live runtime `c398647f17fa-c82432af60`: menu navigation, episode selection, ship menu, first mission, and named save creation observed. A later black-screen menu transition remains reproducible enough to block promotion. The shared loader now downloads at most four assets concurrently, verifies each SHA-256, preserves manifest order, and cancels outstanding requests on failure. Local and live OpenTyrian boot passed with this loader; this is not a controlled startup benchmark. A future asset audit should remove unused DOS utilities from the 106-file Tyrian runtime preload while preserving required data and notices.

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
