---
layout: ../layouts/Article.astro
title: How the clean room works
description: Clean-room builds run decompiled game code with every retail asset regenerated, so no original ROM, texture or sound is distributed.
---
A clean-room build is a game you can play in the browser that contains nothing copied from the retail release. The game logic runs from a decompilation or a from-scratch engine. Everything else is regenerated.

## Two rooms

The work is split in two, and only one side is ever published.

- **The dirty room** reads the retail game. It extracts a short list of coarse facts and nothing more.
- **The clean room** sees only those facts. It generates new textures, new audio and new art from them, and builds the game.

## What is kept

- Geometry and collision, so levels have the right shape.
- Code, from the public decompilation projects.
- Text and sequence data.
- For textures: a coarse colour grid and a two-bit alpha outline, not the image.
- For sounds: an outline of the sample, not the recording.

## What is never published

- ROMs or disc images.
- The dirty tree, development builds, or clips of the retail game.
- Retail textures, music, sound effects or voice recordings. Voices are never cloned from the original performers.

## The taint scan

Before a build is published, every generated file is compared against the retail data. The scan has to report zero failing files, or the build does not go out.

## What that means when you play

The games look and sound different from the originals. Textures are simpler and audio is regenerated. The layout, the physics and the way each game plays come from the decompiled code.

Each build has its own repository, linked from its game page, with the generators and a status log.
