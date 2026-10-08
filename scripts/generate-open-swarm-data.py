#!/usr/bin/env python3
"""Draft independent data for the pinned arcade-js Invaders translation.

Several gameplay templates remain incomplete. It is an asset-format probe,
not a complete replacement image or a playable release. No original ROM is read.
Usage: python scripts/generate-open-swarm-data.py OUTPUT_DIRECTORY [--shot2-experiment] [--saucer-experiment]
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


def generate(output: Path, shot2_experiment: bool = False,
             saucer_experiment: bool = False) -> None:
    output.mkdir(parents=True, exist_ok=True)
    # Reuse the five-column drafting alphabet authored for Open Junction.
    # That alphabet and these new table layouts are CC0-1.0; it was not
    # extracted or traced from the historical arcade game.
    font = runpy.run_path(str(Path(__file__).with_name("generate-open-junction-glyphs.py")))["FONT"]
    data = bytearray(ROM_BYTES)
    # The translated drawDigit leaf adds 0x1a to each BCD nibble, so reserve
    # sprite IDs 0x1a..0x23 for 0..9. Place Z after that fixed numeric band.
    symbols = " ABCDEFGHIJKLMNOPQRSTUVWXY0123456789Z.-!:?"
    assert len(symbols) <= GLYPH_SLOTS and len(set(symbols)) == len(symbols)
    ids = {symbol: index for index, symbol in enumerate(symbols)}
    assert [ids[str(digit)] for digit in range(10)] == list(range(0x1A, 0x24))
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
        0b00001100, 0b00111100, 0b01111110, 0b11111111,
        0b11011011, 0b11111111, 0b00100100, 0b01000010,
        0b01000010, 0b00100100, 0b11111111, 0b11011011,
        0b11111111, 0b01111110, 0b00111100, 0b00001100,
    )
    for frame in range(6):
        mask = frame % 3
        pattern = bytes((row ^ (0b00000001 << mask)) & 0xff for row in craft)
        start = 0x1C00 + frame * 16
        data[start:start + 16] = pattern
    data[0x1C60:0x1C70] = bytes(craft)
    data[0x1C70:0x1C90] = bytes(
        (0b00001100 if row % 3 else 0b10100101) for row in range(32)
    )
    data[0x1C90:0x1C98] = bytes((0b00001100,) * 8)
    # Three-byte frames for an experimental descending-shot data format.
    # Its translated stepper adds three to the pointer and wraps at
    # low byte 0xf9, so four frames must fill 0x1ced..0x1cf8.
    shot_frames = (
        0b00001100, 0b00111100, 0b00001100,
        0b00001000, 0b00011100, 0b00001000,
        0b00100100, 0b00001100, 0b00100100,
        0b00010000, 0b00111000, 0b00010000,
    )
    data[0x1CED:0x1CF9] = bytes(shot_frames)
    data[0x1CDC:0x1CE2] = bytes((0b01000010, 0b00100100, 0b00001100,
                                0b00001100, 0b00100100, 0b01000010))
    # The shield initializer copies 22 *two-byte* rows per bunker. Author a
    # narrower arch with a central opening in that actual interleaved format.
    shield_rows = []
    for row in range(22):
        if row in (0, 21):
            mask = 0x0FF0
        elif row in (1, 20):
            mask = 0x3FFC
        elif 8 <= row <= 13:
            mask = 0xF81F
        elif 2 <= row <= 19:
            mask = 0x7FFE
        else:
            mask = 0
        shield_rows.extend(mask.to_bytes(2, "little"))
    shield = bytes(shield_rows)
    data[0x1D20:0x1D4C] = shield
    # Independent scoring and pace choices in the translated routines'
    # documented table layouts. The five descending fleet thresholds end
    # with zero so advanceFleetMarchSound's unbounded scan always stops.
    data[0x1A11:0x1A16] = bytes((40, 24, 12, 6, 0))
    data[0x1A21:0x1A26] = bytes((18, 15, 12, 9, 6))
    data[0x1DA0:0x1DA3] = bytes((0x10, 0x20, 0x30))
    # advanceToNextRound indexes 1..8 after 0x1da2. These independently
    # chosen heights keep new fleets above the bunkers, with gradual descent.
    # Values stay below 0x78 so tickSaucerSpawnTimer can run in later waves.
    # Zero would start the new fleet over the bottom credit/readout band.
    data[0x1DA3:0x1DAB] = bytes((116, 112, 108, 104, 100, 96, 92, 88))
    # The bonus-saucer score lookup reads four BCD keys. Its parallel table
    # supplies the *low byte of a pointer* to a three-glyph sequence, while
    # the high pointer byte stays in the saucer record. Use 100/200/300/400
    # so each key multiplied by sixteen matches its displayed digits.
    bonus_keys = (0x10, 0x20, 0x30, 0x40)
    data[0x1D4C:0x1D50] = bytes(bonus_keys)
    data[0x1D50:0x1D54] = bytes((0x54, 0x57, 0x5A, 0x5D))
    for digit in range(1, 5):
        start = 0x1D54 + (digit - 1) * 3
        data[start:start + 3] = bytes((ids[str(digit)], ids["0"], ids["0"]))
    # Future saucer sprite records also get independently drawn normal and
    # hit frames; the optional encounter remains disabled/unverified here.
    data[0x1D60:0x1D70] = bytes((0x18, 0x3C, 0x7E, 0xFF, 0xDB, 0xFF, 0x66, 0x24,
                                0x24, 0x66, 0xFF, 0xDB, 0xFF, 0x7E, 0x3C, 0x18))
    data[0x1D7C:0x1D8C] = bytes((0x81 if row % 2 else 0x42) for row in range(16))
    data[0x1854:0x1863] = bytes(bonus_keys[index % 4] for index in range(15))
    # Four ascending BCD score bands select one of five authored shot-rate
    # bytes. Hostile-shot records remain skipped, so these are not yet a
    # claim that shot cadence or difficulty is correct in live gameplay.
    data[0x1CB8:0x1CBC] = bytes((0x05, 0x20, 0x50, 0x99))
    data[0x1AA1:0x1AA6] = bytes((7, 6, 5, 4, 3))
    # The retired player-shot handler advances a low-byte pointer and reads
    # its target's low bit to vary the saucer's horizontal step. Give that
    # pointer an authored full-page direction pattern rather than letting
    # its zeroed high byte read untranslated code space at 0x0000..0x00ff.
    data[0x1900:0x1A00] = bytes(
        1 if (index // 12) % 3 in (0, 2) else 0 for index in range(256)
    )
    # The attract player-ship direction pointer begins on the translated
    # code page and later wraps through 0x74..0x7d. Those bytes are data to
    # the translated runtime. Replace the old instruction-byte dependency
    # with an independently scripted right/hold/left/hold demo pattern.
    demo_direction = (1, 1, 1, 0, 0, 2, 2, 2, 0, 0)
    for offset in range(2, 0x7E):
        data[offset] = demo_direction[(offset - 2) % len(demo_direction)]

    def write_text(offset: int, length: int, value: str) -> None:
        assert len(value) <= length
        encoded = bytes(ids[character] for character in value.ljust(length))
        data[offset:offset + length] = encoded

    write_text(SCORE_HEADER, 28, "OPEN SWARM SCORE1   SCORE2")
    write_text(CREDIT_LABEL, 7, "CREDIT ")
    # The one-player teardown types the first ten glyphs ("GAME OVER ").
    # The two-player handoff types all twenty and stamps its own player digit.
    write_text(0x1AA6, 20, "GAME OVER PLAYER")
    write_text(0x1ABA, 20, "CHOOSE 1 OR 2 PLAYER")
    write_text(0x1ACF, 20, "PRESS 1 TO START")
    write_text(0x1CFA, 4, "OPEN")
    write_text(0x1DAB, 4, "PLAY")
    write_text(0x1DAF, 15, "OPEN SWARM")
    write_text(0x1F80, 10, "OPEN SWARM")
    write_text(0x1F90, 12, "INSERT COIN")
    # A safe screen destination and an authored ten-glyph source replace the
    # otherwise zeroed attract draw record. The following optional script is
    # intentionally empty and has an explicit terminator.
    data[0x1F9C:0x1FA0] = (0x2B14).to_bytes(2, "little") + (0x1F80).to_bytes(2, "little")
    data[0x1FA0] = 0xFF
    write_text(0x1FF3, 4, "PUSH")
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
    # The between-demo reveal walker copies this descriptor to 0x2050. A
    # zero-filled record dispatches address 0 once its timer drains. Author a
    # short, finite terminal animation using the translated 0x050e handler:
    # status bit 0 marks blowup, and the two-tick counter is stored at +10.
    # The descriptor points to our own safe shot sprite/video coordinates.
    attract_reveal = bytearray(16)
    attract_reveal[3:5] = (0x050E).to_bytes(2, "little")
    attract_reveal[5] = 1
    attract_reveal[10] = 2
    attract_reveal[11:13] = (0x1CED).to_bytes(2, "little")
    # This object is serviced by the vblank-only attract task: bit 7 of the
    # coordinate's high byte must match DRAW_PHASE_FLAG=0x80.
    attract_reveal[13:15] = (0x9050).to_bytes(2, "little")
    attract_reveal[15] = 3
    data[0x1BC0:0x1BD0] = attract_reveal
    # 0x1b00 is copied to 0x2000 at round setup. The translated attract
    # loop uses work-RAM 0x2015 == 0xff as its armed sentinel. This is an
    # independently chosen state byte, not a copy of the old ROM template.
    data[0x1B15] = 0xFF
    # The attract demo enters the shared vblank draw tail immediately after
    # copying this image. That tail paints the current alien cell even before
    # the march selector runs, so both its reference and queued destination
    # must start in video-safe coordinates instead of zeroed work RAM.
    data[0x1B09:0x1B0D] = (0x4078).to_bytes(2, "little") * 2
    data[0x1B8F:0x1B91] = bytes((0xFF, 0x19))
    data[0x1B83:0x1B8D] = bytes((0, 0, 0, 32, 0x60, 0x1D, 0xD0, 0x28, 16, 2))
    data[0x1B8D:0x1B8F] = bytes((0x53, 0x18))
    # The cold-boot copier also seeds 0x20e9 from this image. Mark the
    # independently authored attract world active so the vblank task runner
    # can actually service its object table after the title sequence.
    data[0x1BE9] = 1
    data[0x1B6C] = 10  # typeDrawScriptRecord glyph count
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
    if shot2_experiment:
        # Private hostile-fire format experiment. A 0x0400 object timer
        # spaces launches so a moving player can clear a wave, while a still
        # player can lose all ships. This requires the pinned GPL copyback
        # patch; the baseline keeps slot 2 skipped.
        data[0x1B30] = 4
        data[0x1B3A] = 4  # short terminal blowup countdown
        data[0x1B7E] = 0xFC  # signed -4 descent step in round work template
    if saucer_experiment:
        # Keep object slot 4 active so the experimental GPL saucer-only
        # handler can observe later arm events. Source patch required: the
        # unmodified handler would copy the disabled record template over
        # this slot at its first no-saucer pass.
        data[0x1B50:0x1B53] = bytes((0, 0, 0))
        data[0x1B32] = 2  # the shared vblank mode cell gates saucer service
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
    # The translated hostile-hit path arms the ship's death animation only for
    # collisions in the coordinate band 30..38. An authored low coordinate of
    # 0x20 seats the 16-row craft in that band; 0x00 made it unreachable.
    data[0x1B18:0x1B1A] = (0x1C60).to_bytes(2, "little")
    data[0x1B1A:0x1B1C] = (0x6020).to_bytes(2, "little")
    data[0x1B1C] = 16
    # A separate eight-row beam starts above the raised craft at 0x6838 >> 3.
    # Launching it at 0x6820, the craft's new Y, immediately collided with
    # the player; the board's rotated Y rises toward 0xd8 at the top.
    # A positive four-unit step advances the beam into the fleet.
    data[0x1B27:0x1B29] = (0x1C90).to_bytes(2, "little")
    # Retiring a missed shot takes a short, visible 16-frame interval;
    # zero would underflow and hold the single-shot latch for 256 frames.
    data[0x1B26] = 0x10
    data[0x1B29:0x1B2B] = (0x6838).to_bytes(2, "little")
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
                               "one-player and two-player game-over banner text",
                               "attract and credit prompts", "bounded attract draw record",
                               "six alien frames", "reserve craft", "explosion frames",
                               "shield buffer template", "point-table heading",
                               "two empty draw-script terminators",
                               "three one-tick blank attract transitions",
                               "finite attract reveal object descriptor",
                               "armed attract-state sentinel", "object dispatch targets",
                               "video-safe attract fleet reference and first draw coordinate",
                               "video-safe reserve-craft descriptor",
                               "beam sprite and video-safe shot descriptor",
                               "16-frame shot retire timer", "invader-hit explosion descriptor",
                               "player-one 0x21xx field-page selector",
                               "slot-2 descending-shot frames and blowup art",
                               "slot-2 three-row descriptor",
                               "three-tier BCD score table", "eight later-wave start heights", "fleet tempo bands",
                               "five alien-shot rate choices",
                               "full-page saucer direction sequence and work-RAM pointer",
                               "attract-demo ship direction script",
                               "saucer BCD award keys, score glyph pointers and sequences",
                               "saucer sprite, hit art, record, and key sequence"],
        "missingComponents": [
            "remaining work-RAM and object templates", "functional alien-shot records for slots 3-4",
            "remaining attract animation art and scripts",
            "complete tested gameplay",
        ],
        "file": {"name": "open-swarm-draft.bin", "bytes": len(image),
                 "sha256": hashlib.sha256(image).hexdigest()},
    }
    variations = []
    if shot2_experiment:
        variations.append("slot-2 0x0400 launch timer, four-tick blowup, signed -4 descent; requires shot-2 GPL source patch")
    if saucer_experiment:
        variations.append("active slot-4 saucer poll with second alien-shot lane omitted; requires saucer-only GPL source patch")
    if variations:
        manifest["experimentalVariations"] = variations
    (output / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")


if __name__ == "__main__":
    flags = sys.argv[2:]
    if len(sys.argv) < 2 or len(flags) != len(set(flags)) or any(
        flag not in ("--shot2-experiment", "--saucer-experiment") for flag in flags
    ):
        raise SystemExit("Usage: generate-open-swarm-data.py OUTPUT_DIRECTORY [--shot2-experiment] [--saucer-experiment]")
    generate(Path(sys.argv[1]), shot2_experiment="--shot2-experiment" in flags,
             saucer_experiment="--saucer-experiment" in flags)
