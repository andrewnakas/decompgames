---
layout: ../../layouts/Article.astro
title: OpenRCT2 required files and browser status
description: What OpenRCT2 needs from a RollerCoaster Tycoon 2 installation, how park saves differ from game data, and the current browser integration status.
---

**Decomp Games does not yet offer a playable OpenRCT2 integration.** The [RollerCoaster Tycoon 2 catalog entry](/games/rollercoaster-tycoon-2/) links to the upstream project. Its browser source provides a useful starting point, but our local-file adapter and gameplay tests are unfinished.

## Keep the installation folders together

OpenRCT2 needs original game data in addition to its open-source engine. A shortcut or installer executable is not a replacement for an installed game's resources. The [upstream browser loader](https://github.com/OpenRCT2/OpenRCT2/blob/bf7695b6e3e6a9e1673d79cec22acbfafa90b74d/emscripten/static/index.js) looks for `Data/ch.dat` inside an installation. That file is an identification marker, not a complete set of game assets by itself.

Keep the directory structure intact, including the installation's `Data`, `ObjData`, and `Scenarios` folders. Moving every file into a single flat folder loses the relationship between resource types and can create conflicting names. Optional landscapes and track designs belong with their respective folders too.

Our adapter work currently checks a selected folder before reading its contents. It rejects ambiguous installations, conflicting names, unsafe paths, and data over its provisional memory budget. Passing those checks will not establish that a particular edition works; that requires an actual game test. ZIP support for this adapter is still pending.

## Park files are separate from installation data

A saved park records your work. It does not supply all the artwork and objects the engine needs to run. Upstream browser code supports `.park` loading and saving, and also handles `.td6` track designs through its [browser save hooks](https://github.com/OpenRCT2/OpenRCT2/blob/bf7695b6e3e6a9e1673d79cec22acbfafa90b74d/emscripten/deps.js).

Keep your existing park saves backed up before testing any new runtime. Browser file-picker support varies, so automatic saving and manual downloads must be tested separately. We have not verified either path for OpenRCT2 on this site.

## What is still being built?

The integration needs a browser build with practical memory and worker settings, a loader that preserves your installation folders, and tested save handling. The [upstream project](https://github.com/OpenRCT2/OpenRCT2) remains the destination for its currently supported downloads and installation instructions. Follow our [verification guide](/guides/verification/) to see why a successful build alone does not earn a playable label.

Documentation reviewed September 20, 2026; no OpenRCT2 gameplay or browser compatibility claim is made here.
