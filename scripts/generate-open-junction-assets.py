#!/usr/bin/env python3
"""Generate an independent CC0 visual pack for the reSL decompilation."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
import struct
import sys
import zlib

if len(sys.argv) != 2:
    raise SystemExit("Usage: generate-open-junction-assets.py OUTPUT_DIR")

output = Path(sys.argv[1]).resolve()
output.mkdir(parents=True, exist_ok=True)

HEADER = bytes.fromhex("220007383f3e06191124041b0312023f")
PALETTE = [
    (21, 59, 80), (11, 20, 38), (129, 160, 190), (86, 112, 166),
    (226, 234, 240), (245, 213, 104), (237, 151, 67), (47, 114, 180),
    (37, 76, 99), (211, 72, 81), (145, 72, 112), (90, 180, 172),
    (47, 114, 123), (152, 226, 186), (45, 135, 91), (255, 255, 255),
]

FONT = {
    " ": ("00000",) * 7,
    "-": ("00000", "00000", "00000", "11111", "00000", "00000", "00000"),
    "0": ("01110", "10001", "10011", "10101", "11001", "10001", "01110"),
    "1": ("00100", "01100", "00100", "00100", "00100", "00100", "01110"),
    "2": ("01110", "10001", "00001", "00010", "00100", "01000", "11111"),
    "3": ("11110", "00001", "00001", "01110", "00001", "00001", "11110"),
    "4": ("00010", "00110", "01010", "10010", "11111", "00010", "00010"),
    "5": ("11111", "10000", "10000", "11110", "00001", "00001", "11110"),
    "6": ("01110", "10000", "10000", "11110", "10001", "10001", "01110"),
    "7": ("11111", "00001", "00010", "00100", "01000", "01000", "01000"),
    "8": ("01110", "10001", "10001", "01110", "10001", "10001", "01110"),
    "9": ("01110", "10001", "10001", "01111", "00001", "00001", "01110"),
}

for letter, rows in {
    "A": ("01110","10001","10001","11111","10001","10001","10001"),
    "B": ("11110","10001","10001","11110","10001","10001","11110"),
    "C": ("01111","10000","10000","10000","10000","10000","01111"),
    "D": ("11110","10001","10001","10001","10001","10001","11110"),
    "E": ("11111","10000","10000","11110","10000","10000","11111"),
    "F": ("11111","10000","10000","11110","10000","10000","10000"),
    "G": ("01111","10000","10000","10111","10001","10001","01111"),
    "H": ("10001","10001","10001","11111","10001","10001","10001"),
    "I": ("11111","00100","00100","00100","00100","00100","11111"),
    "J": ("00111","00010","00010","00010","10010","10010","01100"),
    "K": ("10001","10010","10100","11000","10100","10010","10001"),
    "L": ("10000","10000","10000","10000","10000","10000","11111"),
    "M": ("10001","11011","10101","10101","10001","10001","10001"),
    "N": ("10001","11001","10101","10011","10001","10001","10001"),
    "O": ("01110","10001","10001","10001","10001","10001","01110"),
    "P": ("11110","10001","10001","11110","10000","10000","10000"),
    "Q": ("01110","10001","10001","10001","10101","10010","01101"),
    "R": ("11110","10001","10001","11110","10100","10010","10001"),
    "S": ("01111","10000","10000","01110","00001","00001","11110"),
    "T": ("11111","00100","00100","00100","00100","00100","00100"),
    "U": ("10001","10001","10001","10001","10001","10001","01110"),
    "V": ("10001","10001","10001","10001","10001","01010","00100"),
    "W": ("10001","10001","10001","10101","10101","10101","01010"),
    "X": ("10001","10001","01010","00100","01010","10001","10001"),
    "Y": ("10001","10001","01010","00100","00100","00100","00100"),
    "Z": ("11111","00001","00010","00100","01000","10000","11111"),
}.items():
    FONT[letter] = rows


def canvas(width: int, height: int, color: int = 0) -> list[bytearray]:
    return [bytearray([color]) * width for _ in range(height)]


def rect(image: list[bytearray], x: int, y: int, width: int, height: int, color: int) -> None:
    for py in range(max(0, y), min(len(image), y + height)):
        image[py][max(0, x):min(len(image[0]), x + width)] = bytes([color]) * max(0, min(len(image[0]), x + width) - max(0, x))


def text(image: list[bytearray], x: int, y: int, value: str, color: int, scale: int = 1) -> None:
    for char in value.upper():
        rows = FONT.get(char, FONT[" "])
        for row, bits in enumerate(rows):
            for col, bit in enumerate(bits):
                if bit == "1":
                    rect(image, x + col * scale, y + row * scale, scale, scale, color)
        x += 6 * scale


def dot7(image: list[bytearray]) -> bytes:
    height, width = len(image), len(image[0])
    result = bytearray(HEADER)
    for y in range(0, height, 7):
        for x in range(0, width, 8):
            groups: dict[bytes, int] = {}
            for bit in range(4):
                rows = bytearray()
                for dy in range(7):
                    mask = 0
                    for dx in range(8):
                        mask <<= 1
                        if y + dy < height and x + dx < width and image[y + dy][x + dx] & (1 << bit):
                            mask |= 1
                    rows.append(mask)
                encoded = bytes([rows[0]]) if len(set(rows)) == 1 else bytes(rows)
                groups[encoded] = groups.get(encoded, 0) | (1 << bit)
            for rows, planes in groups.items():
                result.append(planes | (0x10 if len(rows) == 7 else 0))
                result.extend(rows)
    return bytes(result)


def decode_dot7(data: bytes, width: int, height: int) -> list[bytearray]:
    """Independent format check matching the pinned engine's tile consumption."""
    if data[:16] != HEADER:
        raise ValueError("Invalid .7 header")
    image = canvas(width, height)
    cursor = 16
    for y in range(0, height, 7):
        for x in range(0, width, 8):
            drawn = 0
            while drawn != 0x0f:
                command = data[cursor]
                cursor += 1
                planes = command & 0x0f
                drawn |= planes
                rows = data[cursor:cursor + (7 if command & 0xf0 else 1)]
                cursor += len(rows)
                for dy in range(7):
                    bits = rows[dy] if len(rows) == 7 else rows[0]
                    for dx in range(8):
                        if y + dy < height and x + dx < width and bits & (0x80 >> dx):
                            image[y + dy][x + dx] |= planes
    if cursor != len(data):
        raise ValueError(f"Unused .7 bytes: {len(data) - cursor}")
    return image


def png(image: list[bytearray]) -> bytes:
    height, width = len(image), len(image[0])
    raw = bytearray()
    for row in image:
        raw.append(0)
        for index in row:
            raw.extend(PALETTE[index])
    def chunk(kind: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xffffffff)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(bytes(raw), 9)) + chunk(b"IEND", b"")


play = canvas(640, 350, 0)
rect(play, 0, 0, 640, 46, 1)
for x in range(0, 641, 32): rect(play, x, 47, 1, 303, 2)
for y in range(47, 351, 24): rect(play, 0, y, 640, 1, 2)
text(play, 16, 14, "OPEN JUNCTION", 5, 2)
text(play, 440, 18, "RAIL CONTROL", 12, 1)

poster = canvas(640, 350, 0)
for y in range(350):
    poster[y][:] = bytes([1 + (y // 70) % 4]) * 640
for x in range(-150, 800, 80):
    for y in range(120, 350):
        px = x + (y - 120) // 2
        if 0 <= px < 640: poster[y][px] = 13
text(poster, 88, 76, "OPEN JUNCTION", 15, 7)
text(poster, 172, 155, "REBUILT RAIL CONTROL", 5, 2)
text(poster, 214, 288, "CC0 REPLACEMENT DATA", 14, 1)

captions = canvas(640, 350, 0)
for index, label in enumerate(("SIGNAL", "ROUTE", "SWITCH", "FLOW", "GO")):
    y = index * 49
    rect(captions, 0, y, 400, 46, 1 + index % 4)
    text(captions, 146, y + 13, label, 15, 3)

gameover = canvas(640, 263, 0)
rect(gameover, 0, 0, 284, 263, 8)
rect(gameover, 8, 8, 268, 247, 1)
text(gameover, 43, 80, "SHIFT", 15, 6)
text(gameover, 60, 138, "OVER", 6, 6)

files: dict[str, bytes] = {
    "play.7": dot7(play),
    "poster.7": dot7(poster),
    "captions.7": dot7(captions),
    "GAMEOVER.7": dot7(gameover),
    "RULES.TXT": (
        "OPEN JUNCTION\r\n\r\n"
        "Build rails to connect each arriving train with a safe route.\r\n"
        "Use the mouse to place track, change switches, and manage signals.\r\n"
        "The release page lists the exact controls verified in the browser.\r\n\r\n"
        "This manual and all Open Junction visual files are dedicated to the\r\n"
        "public domain under CC0 1.0. They were created without reading the\r\n"
        "original ShortLine resource files.\r\n"
    ).encode("ascii"),
}

for name, source in (("play.7", play), ("poster.7", poster), ("captions.7", captions), ("GAMEOVER.7", gameover)):
    if decode_dot7(files[name], len(source[0]), len(source)) != source:
        raise SystemExit(f"Generated .7 round-trip mismatch: {name}")

(output / "preview-play.png").write_bytes(png(play))
(output / "preview-poster.png").write_bytes(png(poster))

for name, symbol in {
    "build_rail_icon.png": "R",
    "call_server_icon.png": "S",
    "time_fast2.png": "2",
    "time_fast3.png": "3",
}.items():
    icon = canvas(32, 32, 1)
    rect(icon, 2, 2, 28, 28, 3)
    text(icon, 10, 7, symbol, 15, 3)
    files[name] = png(icon)

records = []
for name, data in files.items():
    (output / name).write_bytes(data)
    records.append({"name": name, "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()})

manifest = {
    "id": "open-junction",
    "title": "Open Junction",
    "license": "CC0-1.0",
    "originalAssetsRead": False,
    "source": "scripts/generate-open-junction-assets.py",
    "paletteRGB": PALETTE,
    "scope": "Independent loading, background, game-over, icon, and manual files for a replacement-only reSL build.",
    "files": sorted(records, key=lambda item: item["name"]),
    "remainingGate": "Generated glyphs, remaining source data, geometry, and gameplay require a full release audit.",
}
(output / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
print(json.dumps(manifest, indent=2))
