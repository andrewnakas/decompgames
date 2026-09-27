#!/usr/bin/env python3
"""Draft independent text/glyph data for the pinned arcade-js Invaders translation.

This deliberately leaves gameplay templates blank. It is an asset-format probe,
not a complete replacement image or a playable release. No original ROM is read.
Usage: python scripts/generate-open-swarm-data.py OUTPUT_DIRECTORY
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
import runpy
import sys


ROM_BYTES = 8192
GLYPH_BASE = 0x1E00
GLYPH_SLOTS = 64
SCORE_HEADER = 0x1AE4
CREDIT_LABEL = 0x1FA9
IDENTITY = "OPEN SWARM"


def generate(output: Path) -> None:
    output.mkdir(parents=True, exist_ok=True)
    # Reuse the five-column drafting alphabet authored for Open Junction.
    # That alphabet and these new table layouts are CC0-1.0; it was not
    # extracted or traced from the historical arcade game.
    font = runpy.run_path(str(Path(__file__).with_name("generate-open-junction-glyphs.py")))["FONT"]
    data = bytearray(ROM_BYTES)
    symbols = " ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.-!:?"
    assert len(symbols) <= GLYPH_SLOTS and len(set(symbols)) == len(symbols)
    ids = {symbol: index for index, symbol in enumerate(symbols)}
    for symbol, index in ids.items():
        pattern = font[symbol].split("/")
        assert len(pattern) == 7 and all(len(row) == 5 for row in pattern)
        rows = [int(row, 2) << 2 for row in pattern] + [0]
        data[GLYPH_BASE + index * 8:GLYPH_BASE + (index + 1) * 8] = bytes(rows)

    # The translated blitter reads six 16-byte alien frames from 0x1c00,
    # followed by a reserve craft and a two-frame explosion at 0x1c60.
    # These silhouettes were drawn for Open Swarm; the bytes are not taken
    # from a game image. Keep this probe's gameplay tables blank.
    craft = (
        0b00011000, 0b00111100, 0b01111110, 0b11111111,
        0b11011011, 0b11111111, 0b00100100, 0b01000010,
        0b01000010, 0b00100100, 0b11111111, 0b11011011,
        0b11111111, 0b01111110, 0b00111100, 0b00011000,
    )
    for frame in range(6):
        mask = frame % 3
        pattern = bytes((row ^ (0b00000001 << mask)) & 0xff for row in craft)
        start = 0x1C00 + frame * 16
        data[start:start + 16] = pattern
    data[0x1C60:0x1C70] = bytes(craft)
    data[0x1C70:0x1C90] = bytes(
        (0b00011000 if row % 3 else 0b10100101) for row in range(32)
    )
    # The shield initializer copies exactly 0x2c bytes per bunker. Use an
    # independent arch with a central opening so the buffer is nonblank.
    shield = bytes(
        0b11111111 if row < 22 else (0b11100111 if row < 36 else 0b11000011)
        for row in range(44)
    )
    data[0x1D20:0x1D4C] = shield

    def write_text(offset: int, length: int, value: str) -> None:
        assert len(value) <= length
        encoded = bytes(ids[character] for character in value.ljust(length))
        data[offset:offset + length] = encoded

    write_text(SCORE_HEADER, 28, "OPEN SWARM SCORE1   SCORE2")
    write_text(CREDIT_LABEL, 7, "CREDITS")
    image = bytes(data)
    (output / "open-swarm-draft.bin").write_bytes(image)
    manifest = {
        "status": "incomplete-data-format-probe",
        "license": "CC0-1.0",
        "originalAssetsRead": False,
        "target": "arcade-js Space Invaders idiomatic translation",
        "upstreamRevision": "e849d086f4168c9a0e1ab501d62efbe3766def8a",
        "authoredComponents": ["5x7 glyph shapes", "score header", "credit label",
                               "six alien frames", "reserve craft", "explosion frames",
                               "shield buffer template"],
        "missingComponents": [
            "work-RAM and object templates", "remaining in-game sprite descriptors",
            "score and fire-rate tables", "attract and game-over scripts",
            "complete tested gameplay",
        ],
        "file": {"name": "open-swarm-draft.bin", "bytes": len(image),
                 "sha256": hashlib.sha256(image).hexdigest()},
    }
    (output / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Usage: generate-open-swarm-data.py OUTPUT_DIRECTORY")
    generate(Path(sys.argv[1]))
