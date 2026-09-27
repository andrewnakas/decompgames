#!/usr/bin/env python3
"""Author a standalone SkyRoads-format road archive without retail data.

This is an experimental *data* component, not a playable release. It writes
one demo road and thirty selectable roads. The format is documented at the
pinned skyroads-32x revision df219e03b854153291b32224593013b60d861d40.
"""
import argparse
import hashlib
import json
import struct
from pathlib import Path


def encode_literals(raw: bytes) -> bytes:
    """Encode the documented LZS literal path (two tag bits plus eight data bits)."""
    bits = []
    for value in raw:
        bits.extend((1, 1))
        bits.extend((value >> shift) & 1 for shift in range(7, -1, -1))
    while len(bits) % 8:
        bits.append(0)
    payload = bytes(
        sum(bits[offset + bit] << (7 - bit) for bit in range(8))
        for offset in range(0, len(bits), 8)
    )
    return bytes((8, 8, 8)) + payload


def road_palette(index: int) -> bytes:
    """72 independent six-bit RGB colors, grouped as 24 light/mid/shadow triples."""
    colors = bytearray()
    for group in range(24):
        hue = (index * 7 + group * 5) % 24
        base = (12 + (hue * 3) % 45, 18 + (hue * 5) % 38, 15 + (hue * 7) % 42)
        for numerator in (4, 3, 2):
            colors.extend(channel * numerator // 4 for channel in base)
    return bytes(colors)


def make_rows(index: int) -> list[list[int]]:
    """A center-safe course with authored alternating shoulders and landmarks."""
    floor = 3
    boost = 10
    supply = 9
    tunnel = 0x133
    half_block = 0x233
    length = 42 + index % 6 * 4
    rows = []
    for row in range(length):
        cells = [floor] * 7
        if 8 <= row < length - 10:
            phase = (row // 5 + index) % 4
            if phase == 0:
                cells[0] = cells[6] = 0
            elif phase == 1:
                cells[1] = half_block
                cells[5] = 0
            elif phase == 2:
                cells[0] = 0
                cells[5] = half_block
            else:
                cells[1] = cells[6] = 0
            if row % 13 == 0:
                cells[3] = supply
            elif row % 11 == 0:
                cells[3] = boost
        if row >= length - 7:
            cells = [tunnel] * 7
        rows.append(cells)
    return rows


def make_archive() -> tuple[bytes, list[dict]]:
    records = []
    blobs = []
    for index in range(31):
        rows = make_rows(index)
        grid = b''.join(struct.pack('<7H', *row) for row in rows)
        # The three metadata words are gravity, fuel, oxygen.
        blob = struct.pack('<3H', 8, 150, 60) + road_palette(index) + encode_literals(grid)
        records.append({'entry': index, 'rows': len(rows), 'grid_sha256': hashlib.sha256(grid).hexdigest()})
        blobs.append((blob, len(grid)))
    position = len(blobs) * 4
    directory = bytearray()
    for blob, raw_size in blobs:
        if position > 0xffff or raw_size > 0xffff:
            raise ValueError('Road archive exceeds 16-bit format limits')
        directory.extend(struct.pack('<HH', position, raw_size))
        position += len(blob)
    if position > 0xffff:
        raise ValueError('Road archive exceeds 16-bit offset limit')
    return bytes(directory) + b''.join(blob for blob, _ in blobs), records


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    archive, records = make_archive()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_bytes(archive)
    manifest = {
        'status': 'experimental replacement road data, not a playable game',
        'provenance': 'independently authored procedural geometry and colors; no original game files read',
        'format_source_revision': 'haroldo-ok/skyroads-32x@df219e03b854153291b32224593013b60d861d40',
        'license': 'CC0-1.0',
        'archive_sha256': hashlib.sha256(archive).hexdigest(),
        'archive_size': len(archive),
        'roads': records,
    }
    args.output.with_suffix('.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
    print(f'{args.output}: {len(archive)} bytes, 31 independent roads')
