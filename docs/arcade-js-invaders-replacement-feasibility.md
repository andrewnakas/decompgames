# Space Invaders translation: independent-data feasibility

Research revision: [`qarl/arcade-js` `e849d086f4168c9a0e1ab501d62efbe3766def8a`](https://github.com/qarl/arcade-js/tree/e849d086f4168c9a0e1ab501d62efbe3766def8a). The upstream repository is GPL-3.0. Its `games/invaders/manifest.js` declares a browser frontend and an idiomatic JavaScript translation of the 8080 program, but also requires a byte-exact 8,192-byte original program ROM. `boards/invaders/memory.js` maps reads at `0x0000`–`0x1fff` to that ROM. We have not loaded original ROM bytes, created a replacement pack, or play-tested an independent build.

The translated functions do **not** make the ROM dispensable. The upstream `games/invaders/idiomatic/names.js` labels data addresses in it, including fleet speed and shot-rate tables (`0x1a11`, `0x1a21`, `0x1aa1`), work-RAM and object templates (`0x1b00` onward), alien and explosion sprite bitmaps (`0x1c00` onward), shield and score data (`0x1d20` onward), glyph bitmaps (`0x1e00`), and attract, coin, credit, and game-over text in the upper part of the image. The board has no separate graphics ROM; it paints a one-bit framebuffer from this data. The existing sound map refers to visitor-supplied original-game samples, so an independent silent build must omit those samples and default to no audio.

An eligible Decomp Games adaptation would need to:

1. Inventory every runtime read of the 8 KiB image, including indirect reads and any translated fallback, without copying bytes from a game ROM.
2. Author original sprite and glyph bitmaps, text, shields, templates, and gameplay/balance tables in the expected formats. Generate a deterministic 8 KiB **new** data image and record the source, license, and SHA-256 for each input and the output.
3. Give that new image a distinct manifest and checksum. The upstream hash is an original-ROM identity check, not a license to mirror its contents; do not relabel a modified image as the original set.
4. Test a muted real browser session from attract/start through movement, fire, alien hits, wave transition, loss, and restart, then document persistence if the adaptation supports it. A rendered title or a few moving pixels would not count as a complete playable game.

This is a candidate scope, not a release. Its original-game title and visual identity should be replaced for the independently authored edition; the upstream historical project remains credited for the GPL translation.
