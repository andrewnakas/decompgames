---
layout: ../../layouts/Article.astro
title: What “tested” actually means
description: Our public verification standard separates a successful launch, gameplay checks, and a complete playthrough.
---
A title screen is encouraging. It is not proof that every level, save, sound effect, or controller works.

## Three independent questions

- **Content:** does the package include a full game, limited demo, or only an engine?
- **Browser verification:** what interactions were tested, on which browser, and when?
- **Playthrough:** has somebody completed the entire game on this exact build?

Each game page publishes its latest record. An unverified entry carries no browser-support promise. A smoke test checks loading and startup. A gameplay test checks representative input, sound, and play; its recorded scope explains the limits. Full playthrough verification requires separate evidence.

## A reproducible report

Useful reports include the game and runtime revision, browser and operating system versions, steps performed, expected and observed behavior, and whether save/reload survived a new session. Do not report controller or touch support based on keyboard testing.

## Changes can invalidate a result

An engine upgrade, data update, browser change, or hosting-header change can break a working game. We retain versioned manifests and previous packages for rollback. The date shown is the latest recorded test, not a promise that no future browser update can break it.
