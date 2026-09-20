# OpenRCT2 integration record

Research date: September 20, 2026. Inspected upstream revision `bf7695b6e3e6a9e1673d79cec22acbfafa90b74d`. This is an integration candidate, not a tested hosted build.

## Primary sources and findings

- [Upstream browser bootstrap](https://github.com/OpenRCT2/OpenRCT2/blob/bf7695b6e3e6a9e1673d79cec22acbfafa90b74d/emscripten/static/index.js) instantiates the asynchronous `OPENRCT2_WEB` factory, restores `/persistent`, `/RCT`, and `/OpenRCT2`, then runs the game. It checks for `Data/ch.dat` in an imported installation. Its generic ZIP extractor is not suitable for direct reuse without path and extraction-budget validation.
- [Build recipe](https://github.com/OpenRCT2/OpenRCT2/blob/bf7695b6e3e6a9e1673d79cec22acbfafa90b74d/scripts/build-emscripten) uses pthreads, an initial 2 GB memory allocation, and a 120-thread pool. It expects ICU, libzip, zstd, and JSON dependencies in its container. Network, HTTP, Discord, OpenGL, and TTF support are disabled by that recipe. Do not launch this configuration on visitors' devices without a resource-budget review.
- [CI workflow](https://github.com/OpenRCT2/OpenRCT2/blob/bf7695b6e3e6a9e1673d79cec22acbfafa90b74d/.github/workflows/ci.yml) builds with `ghcr.io/openrct2/openrct2-build:26-emscripten`. Pin the image digest and exact dependency sources before producing our corresponding-source package. A moving image tag is not a reproducibility record.
- [Browser save hooks](https://github.com/OpenRCT2/OpenRCT2/blob/bf7695b6e3e6a9e1673d79cec22acbfafa90b74d/emscripten/deps.js) use native file pickers where available, with download/file-input fallbacks. Autosaves without a persistent file handle need separate testing; an exported `.park` and the site's JSON backup are different formats.
- [Project README](https://github.com/OpenRCT2/OpenRCT2/blob/bf7695b6e3e6a9e1673d79cec22acbfafa90b74d/readme.md) identifies the engine as GPL-3.0-or-later. Original commercial game data is separate and will not be bundled by this site.

## Work completed

`src/lib/rct2-import.ts` provides the directory-import foundation. It locates exactly one installation marker, preserves game subdirectories, excludes unrelated installation-root files, checks paths and case-insensitive collisions, and enforces file-count and byte budgets before reading data. It reads only selected local files and contains no network calls. Tests use synthetic bytes; no proprietary game files are stored in this repository.

This helper is intentionally not connected to a public Play action yet. It validates folder structure and budgets, not the authenticity, edition compatibility, or completeness of all game assets. ZIP import is not implemented for this adapter. The provisional 512 MiB limit may reject some installations and must be reviewed against actual memory use.

## Next concrete steps

1. Build from a pinned dependency container with a small thread pool and measured initial memory. Publish the exact source, patch, build recipe, and checksums before serving binaries.
2. Add the modular runtime factory adapter and worker URL resolution. The current generic player expects a global Module runtime and cannot simply load this factory unchanged.
3. Configure cross-origin isolation for the dedicated player and its resources, then verify `crossOriginIsolated` and SharedArrayBuffer in each claimed browser. Check effects on all existing games before changing shared headers.
4. Mount imported installation data in memory. Keep saves separate from commercial assets so exported backups do not accidentally include an entire game installation.
5. Connect native `.park` import/export and test cancelled file pickers, failed storage, interrupted startup, save reload, and network requests. Keep sound off throughout development.
6. Obtain a user-supplied compatible installation for end-to-end testing. No such data was used in this pass. Leave the catalog entry as a project link until these steps pass.
