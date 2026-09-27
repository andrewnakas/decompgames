#!/usr/bin/env python3
"""Experimental independent SkyRoads-format animation, HUD and road geometry.

The TREKDAT spans are newly designed minimalist perspective strips. Format
compatibility and actual playability must be tested before any release.
"""
import argparse
import hashlib
import json
import struct
from pathlib import Path


def lzs_literals(raw: bytes) -> bytes:
    bits = []
    for value in raw:
        bits += (1, 1)
        bits.extend((value >> shift) & 1 for shift in range(7, -1, -1))
    while len(bits) % 8:
        bits.append(0)
    return bytes((8, 8, 8)) + bytes(
        sum(bits[at + bit] << (7 - bit) for bit in range(8))
        for at in range(0, len(bits), 8)
    )


def gauge(x: int) -> bytes:
    entries = []
    for segment in range(10):
        ofs = (175 + segment // 5 * 4) * 320 + x + segment % 5 * 7
        entries.append(struct.pack('<HBB', ofs, 5, 3) + bytes((1, 1, 1, 1, 1)) * 3)
    pos = 0
    directory = bytearray()
    for entry in entries:
        directory += struct.pack('<H', pos)
        pos += len(entry)
    return bytes(directory) + b''.join(entries)


def speedometer() -> bytes:
    entries = []
    for segment in range(34):
        ofs = (169 + segment // 17 * 6) * 320 + 111 + segment % 17 * 6
        entries.append(struct.pack('<HBB', ofs, 3, 4) + bytes((1, 1, 1)) * 4)
    pos = 0
    directory = bytearray()
    for entry in entries:
        directory += struct.pack('<H', pos)
        pos += len(entry)
    return bytes(directory) + b''.join(entries)


def intro_animation() -> bytes:
    palette = [
        (0, 0, 0), (2, 4, 11), (5, 14, 30), (4, 34, 39),
        (58, 30, 6), (21, 53, 40), (54, 58, 57), (49, 9, 42),
    ]
    pixels = bytearray([1] * (320 * 200))
    for n in range(55):
        x, y = (n * 79) % 320, (n * 47) % 150
        pixels[y * 320 + x] = 6 if n % 5 == 0 else 3
    out = bytearray(b'ANIM' + struct.pack('<H', 1))
    out += b'CMAP' + bytes((len(palette),))
    out += bytes(channel for color in palette for channel in color)
    out += bytes(len(palette) * 2)
    out += struct.pack('<H', 1)  # one delta picture in frame zero
    out += b'PICT' + struct.pack('<HHH', 0, 200, 320)
    out += lzs_literals(bytes(pixels))
    return bytes(out)


def expanded_record(y: int, col: int, band: int) -> tuple[bytes, bytes]:
    """Input and expanded forms of one three-scanline perspective span."""
    width = 7 + min(band, 9)
    offset = (3 - col) * (width + 2)
    anchor = (y - 32) * 320 + 160
    source = bytearray((3,)) + struct.pack('<H', anchor)
    expanded = bytearray(source)
    for _ in range(3):
        source += bytes((offset, width))
        expanded += bytes((offset, width, 0))
    source.append(0xff)
    expanded.append(0xff)
    return bytes(source), bytes(expanded)


def trek_object() -> tuple[bytes, int, int]:
    """Thirteen directory rows × four columns × six record-kind pointers."""
    groups = (3, 1, 2, 3, 8, 3)  # maximum sequential reads per kind in render.c
    offsets = bytearray()
    source_records = bytearray()
    expanded_records = bytearray()
    for row in range(13):
        band = 7 if row in (11, 12) else min(row, 9)
        y = 35 + band * 9
        for col in range(4):
            for record_count in groups:
                offsets += struct.pack('<H', 0x270 + len(expanded_records))
                for _ in range(record_count):
                    source, expanded = expanded_record(y, col, band)
                    source_records += source
                    expanded_records += expanded
    assert len(offsets) == 0x270
    source = bytes(offsets + source_records)
    raw_size = len(offsets) + len(expanded_records)
    assert raw_size <= 0xffff and len(source) <= raw_size
    return source, raw_size, len(source)


def trek_archive() -> bytes:
    source, raw_size, comp_size = trek_object()
    blob = struct.pack('<HH', raw_size, comp_size) + lzs_literals(source)
    return blob * 8


def make_files() -> dict[str, bytes]:
    return {
        'ANIM.LZS': intro_animation(),
        'DEMO.REC': bytes(6398),  # inert original-independent attract input
        'FUL_DISP.DAT': gauge(229),
        'OXY_DISP.DAT': gauge(30),
        'SPEED.DAT': speedometer(),
        'TREKDAT.LZS': trek_archive(),
        'INTRO.SND': bytes((128,)),  # loader needs nonempty data; null-audio engine must never play it
    }


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('directory', type=Path)
    args = parser.parse_args()
    args.directory.mkdir(parents=True, exist_ok=True)
    files = make_files()
    for name, data in files.items():
        (args.directory / name).write_bytes(data)
    record = {
        'status': 'experimental independent support data; no engine boot or audio verification',
        'license': 'CC0-1.0',
        'source_revision': 'haroldo-ok/skyroads-32x@df219e03b854153291b32224593013b60d861d40',
        'files': {name: {'size': len(data), 'sha256': hashlib.sha256(data).hexdigest()} for name, data in files.items()},
    }
    (args.directory / 'support.json').write_text(json.dumps(record, indent=2) + '\n', encoding='utf-8')
    print(f'wrote {len(files)} experimental support files to {args.directory}')
