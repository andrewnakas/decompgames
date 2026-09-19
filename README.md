# Decomp Games

An open-source catalog and browser player for decompilations, engine recreations, recompilations, and released-source ports. Intended production domain: https://decompgames.com.

## Development status

This repository is **under construction**, not a verified public game release. Catalog play modes currently describe integrations being implemented. Open Cadet, Freedoom, OpenTyrian, and Beneath a Steel Sky have rendered in the local player. Gameplay/audio/save checks and deployment verification are unfinished. See docs/verification-2026-09-18.md and docs/backlog.md. Do not interpret the initial catalog records as compatibility certification.

Public launch requires 8 complete instant-play titles, 2 working local-import integrations, and 30 substantive researched entries. A failed or unverified integration must become a directory entry before public promotion.

## Run locally

Requires Node.js 22+ and pnpm.

```sh
pnpm install
pnpm dev
pnpm check
pnpm build
pnpm preview
```

The production preview runs at http://127.0.0.1:4322. Test large binary packages against that preview: the development server may not discover newly copied ignored binary assets until restarted.

Game binaries are not checked into Git. `scripts/build-engines.sh`, `scripts/patch-engines.py`, and `scripts/release-engines.mjs` are working build recipes, currently using a WSL build directory. Portability and pinned bootstrap automation are still being completed. Never overwrite an already published package revision.

## Structure

- `src/data/games.json`: catalog records and verification scope.
- `src/pages`: static catalog, collections, guides, and player routes.
- `src/player`: Emscripten player and browser-only asset import.
- `public/manifests`: exact runtime revisions, package hashes, and source references.
- `provenance`: asset download origins and checksums.
- `scripts`: builds, catalog validation, and deployment support.

The catalog and player are designed for separate origins. Configure `PUBLIC_PLAYER_ORIGIN=https://play.decompgames.com` when building production discovery pages. Runtime binaries and game data belong in Cloudflare R2; the static shell is deployed with Cloudflare Pages.

## Licensing

New platform code is licensed under **GPL-2.0-or-later**. Upstream engines, code, artwork, fonts, and game data retain their own licenses. A catalog listing does not grant distribution rights. Corresponding source archives and notices must be published alongside every hosted engine binary before release.

## Privacy

Local WAD and PAK files are read into browser memory, never uploaded. Saves use browser IndexedDB, with export/import controls. No accounts, public uploads, advertising trackers, or cloud-save infrastructure are included.
