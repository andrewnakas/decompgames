---
layout: ../../layouts/Article.astro
title: Playing with your own game files
description: How local WAD and PAK imports work, what to select, and why your game files stay on your device.
---
The source of an engine can be open while its original levels, sounds, and artwork remain commercial. Local import lets you supply compatible data from your own installation.

## Doom WAD files

A base **IWAD** contains the full set of resources the engine needs. Select a compatible file such as `DOOM.WAD`, `DOOM2.WAD`, or `DOOM1.WAD`. A mod’s PWAD usually cannot replace the base IWAD. Check the [Doom page](/games/doom/) for current integration limitations.

## Quake PAK files

Look in your installation’s `id1` folder. `pak0.pak` is the base package; a full registered installation normally also includes `pak1.pak`. Select both when available. An installer executable, Steam shortcut, or ZIP containing the installer is not game data.

## What happens to a selected file?

The browser reads it into local memory for the engine. There is no game-file upload endpoint. Your selection is not added to the public catalog or stored on our server. You may need to select the files again on your next visit; save backups are a separate feature.

## When an import fails

Check the extension and exact game edition, then try the files directly instead of an archive. The player rejects malformed headers and excessive archive sizes. A successful format check only establishes that a file resembles the expected container; it does not guarantee a compatible edition or a complete game.
