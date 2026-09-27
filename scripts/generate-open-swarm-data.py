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
        # The video board is ROT270. Each source byte advances along display
        # X while its bits run up display Y (bit 7 is the top of a glyph).
        # Transpose the authored 5x7 upright pattern into that native format.
        columns = []
        for x in range(8):
            value = 0
            for y in range(7):
                if 1 <= x <= 5 and pattern[y][x - 1] == "1":
                    value |= 1 << (7 - y)
            columns.append(value)
        data[GLYPH_BASE + index * 8:GLYPH_BASE + (index + 1) * 8] = bytes(columns)

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
    # Three-byte frames for an experimental descending-shot data format.
    # Its translated stepper adds three to the pointer and wraps at
    # low byte 0xf9, so four frames must fill 0x1ced..0x1cf8.
    shot_frames = (
        0b00011000, 0b00111100, 0b00011000,
        0b00001000, 0b00011100, 0b00001000,
        0b00100100, 0b00011000, 0b00100100,
        0b00010000, 0b00111000, 0b00010000,
    )
    data[0x1CED:0x1CF9] = bytes(shot_frames)
    data[0x1CDC:0x1CE2] = bytes((0b01000010, 0b00100100, 0b00011000,
                                0b00011000, 0b00100100, 0b01000010))
    # The shield initializer copies exactly 0x2c bytes per bunker. Use an
    # independent arch with a central opening so the buffer is nonblank.
    shield = bytes(
        0b11111111 if row < 22 else (0b11100111 if row < 36 else 0b11000011)
        for row in range(44)
    )
    data[0x1D20:0x1D4C] = shield
    # Independent scoring and pace choices in the translated routines'
    # documented table layouts. The five descending fleet thresholds end
    # with zero so advanceFleetMarchSound's unbounded scan always stops.
    data[0x1A11:0x1A16] = bytes((40, 24, 12, 6, 0))
    data[0x1A21:0x1A26] = bytes((18, 15, 12, 9, 6))
    data[0x1DA0:0x1DA3] = bytes((0x10, 0x20, 0x30))
    # Four ascending BCD score bands select one of five authored shot-rate
    # bytes. Hostile-shot records remain skipped, so these are not yet a
    # claim that shot cadence or difficulty is correct in live gameplay.
    data[0x1CB8:0x1CBC] = bytes((0x05, 0x20, 0x50, 0x99))
    data[0x1AA1:0x1AA6] = bytes((7, 6, 5, 4, 3))

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
    # All secondary slots remain skipped (0xfe). The experimental slot-2
    # descriptor below is drafted but not enabled: a headless dispatch probe
    # reset its live status each pass and fired no sustained shot.
    handlers = (0x028E, 0x03BB, 0x0476, 0x04B6, 0x0682)
    for slot, handler in enumerate(handlers):
        record = 0x1B10 + slot * 16
        data[record + 3:record + 5] = handler.to_bytes(2, "little")
        if slot >= 2:
            data[record] = 0xFE
    # Slot 2's work-strip bytes +6..+10 become the five-byte graphics,
    # coordinate, and row-count descriptor at 0x2079..0x207d.
    data[0x1B3B:0x1B3D] = (0x1CED).to_bytes(2, "little")
    data[0x1B3D:0x1B3F] = (0x7050).to_bytes(2, "little")
    data[0x1B3F] = 3
    data[0x1B60] = 0xFF
    # The invader-hit path fills the explosion coordinate at 0x2064/65.
    # Its surrounding descriptor still needs a safe authored bitmap and
    # finite row count; zeros would blit 256 rows from address zero.
    data[0x1B62:0x1B64] = (0x1C70).to_bytes(2, "little")
    data[0x1B66] = 16
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
    # Retiring a missed shot takes a short, visible 16-frame interval;
    # zero would underflow and hold the single-shot latch for 256 frames.
    data[0x1B26] = 0x10
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
        "authoredComponents": ["5x7 glyph shapes encoded for ROT270 display", "score header", "credit label",
                               "six alien frames", "reserve craft", "explosion frames",
                               "shield buffer template", "point-table heading",
                               "two empty draw-script terminators",
                               "three one-tick blank attract transitions",
                               "armed attract-state sentinel", "object dispatch targets",
                               "video-safe reserve-craft descriptor",
                               "beam sprite and video-safe shot descriptor",
                               "16-frame shot retire timer", "invader-hit explosion descriptor",
                               "player-one 0x21xx field-page selector",
                               "slot-2 descending-shot frames and blowup art",
                               "slot-2 three-row descriptor",
                               "three-tier BCD score table", "fleet tempo bands",
                               "five alien-shot rate choices"],
        "missingComponents": [
            "remaining work-RAM and object templates", "functional alien-shot records for slots 2-4",
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
