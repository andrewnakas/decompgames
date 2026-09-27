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
    data[0x1C90:0x1C98] = bytes((0b00011000,) * 8)
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
    write_text(0x1CA3, 21, "OPEN SWARM POINTS")
    # Empty 4-byte-record draw scripts still need the single-byte 0xff
    # sentinel; otherwise the translated walker reads around all of ROM.
    data[0x1DBE] = 0xFF
    data[0x1DCF] = 0xFF
    # Each 12-byte attract record is copied to 0x20c2. Its second running
    # coordinate advances by byte 2 and finishes when it equals byte 9.
    # A one-tick blank transition is intentional while full animation
    # descriptors and art are still unbuilt; it prevents an infinite wait.
    blank_transition = bytes([0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0])
    for offset in (0x1A95, 0x1BB0, 0x1FC9):
        data[offset:offset + 12] = blank_transition
    # 0x1b00 is copied to 0x2000 at round setup. The translated attract
    # loop uses work-RAM 0x2015 == 0xff as its armed sentinel. This is an
    # independently chosen state byte, not a copy of the old ROM template.
    data[0x1B15] = 0xFF
    # The cold-boot copier also seeds 0x20e9 from this image. Mark the
    # independently authored attract world active so the vblank task runner
    # can actually service its object table after the title sequence.
    data[0x1BE9] = 1
    # The ISR's five-record walker dispatches by function address stored at
    # record+3/4. Supply valid targets from the GPL translation. The shot
    # secondary slots are marked skipped (0xfe) until their descriptors
    # place blits safely inside video RAM.
    handlers = (0x028E, 0x03BB, 0x0476, 0x04B6, 0x0682)
    for slot, handler in enumerate(handlers):
        record = 0x1B10 + slot * 16
        data[record + 3:record + 5] = handler.to_bytes(2, "little")
        if slot >= 2:
            data[record] = 0xFE
    data[0x1B60] = 0xFF
    # This is the high address byte, not a player ordinal: 0x21 selects
    # 0x2100, where the translated start flow fills 55 live alien cells.
    data[0x1B67] = 0x21
    # The ship record's five-byte blit descriptor must point into video RAM.
    # 0x6000 >> 3 maps to framebuffer byte 0x2c00; 16 rows remain in bounds.
    data[0x1B18:0x1B1A] = (0x1C60).to_bytes(2, "little")
    data[0x1B1A:0x1B1C] = (0x6000).to_bytes(2, "little")
    data[0x1B1C] = 16
    # A separate eight-row beam starts in the playfield at 0x6820 >> 3.
    # The board's rotated Y coordinate rises toward 0xd8 at the top.
    # A positive four-unit step advances the beam into the fleet.
    data[0x1B27:0x1B29] = (0x1C90).to_bytes(2, "little")
    data[0x1B29:0x1B2B] = (0x6820).to_bytes(2, "little")
    data[0x1B2B] = 8
    data[0x1B2C] = 4
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
                               "shield buffer template", "point-table heading",
                               "two empty draw-script terminators",
                               "three one-tick blank attract transitions",
                               "armed attract-state sentinel", "object dispatch targets",
                               "video-safe reserve-craft descriptor",
                               "beam sprite and video-safe shot descriptor",
                               "player-one 0x21xx field-page selector"],
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
