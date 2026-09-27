#!/usr/bin/env python3
"""Experimental clean visual files for the pinned SkyRoads C port.

Every pixel is generated here from primitive geometry and a new 3x5 font.
The outputs are replacement *data*, not a verified playable release.
"""
import argparse
import hashlib
import json
import struct
from pathlib import Path

from PIL import Image, ImageDraw


PALETTE = [
    (0, 0, 0), (2, 4, 11), (5, 14, 30), (4, 34, 39),
    (58, 30, 6), (21, 53, 40), (54, 58, 57), (49, 9, 42),
]
# Hand-authored compact glyphs. Each two-digit hex value is a five-pixel row.
FONT = {
    'A': '0E 11 1F 11 11', 'B': '1E 11 1E 11 1E', 'C': '0F 10 10 10 0F',
    'D': '1E 11 11 11 1E', 'E': '1F 10 1E 10 1F', 'F': '1F 10 1E 10 10',
    'G': '0F 10 13 11 0F', 'H': '11 11 1F 11 11', 'I': '1F 04 04 04 1F',
    'J': '1F 02 02 12 0C', 'K': '11 12 1C 12 11', 'L': '10 10 10 10 1F',
    'M': '11 1B 15 11 11', 'N': '11 19 15 13 11', 'O': '0E 11 11 11 0E',
    'P': '1E 11 1E 10 10', 'Q': '0E 11 11 13 0F', 'R': '1E 11 1E 12 11',
    'S': '0F 10 0E 01 1E', 'T': '1F 04 04 04 04', 'U': '11 11 11 11 0E',
    'V': '11 11 11 0A 04', 'W': '11 11 15 1B 11', 'X': '11 0A 04 0A 11',
    'Y': '11 0A 04 04 04', 'Z': '1F 02 04 08 1F', '0': '0E 13 15 19 0E',
    '1': '04 0C 04 04 0E', '2': '0E 11 02 04 1F', '3': '1E 01 0E 01 1E',
    '4': '12 12 1F 02 02', '5': '1F 10 1E 01 1E', '6': '0F 10 1E 11 0E',
    '7': '1F 02 04 08 08', '8': '0E 11 0E 11 0E', '9': '0E 11 0F 01 1E',
    ':': '00 04 00 04 00', '-': '00 00 1F 00 00', '/': '01 02 04 08 10',
    ' ': '00 00 00 00 00',
}


def text(image: Image.Image, x: int, y: int, message: str, color: int = 6, scale: int = 2) -> None:
    pixels = image.load()
    for char in message.upper():
        rows = FONT.get(char, FONT[' '])
        for gy, row in enumerate(rows.split()):
            mask = int(row, 16)
            for gx in range(5):
                if mask & (1 << (4 - gx)):
                    for oy in range(scale):
                        for ox in range(scale):
                            px, py = x + gx * scale + ox, y + gy * scale + oy
                            if 0 <= px < image.width and 0 <= py < image.height:
                                pixels[px, py] = color
        x += 6 * scale


def lzs_literals(raw: bytes) -> bytes:
    bits = []
    for value in raw:
        bits.extend((1, 1))
        bits.extend((value >> shift) & 1 for shift in range(7, -1, -1))
    while len(bits) % 8:
        bits.append(0)
    return bytes((8, 8, 8)) + bytes(
        sum(bits[offset + bit] << (7 - bit) for bit in range(8))
        for offset in range(0, len(bits), 8)
    )


def gfx(pictures: list[tuple[int, int, Image.Image]]) -> bytes:
    rgb6 = bytes(channel for color in PALETTE for channel in color)
    out = bytearray(b'CMAP' + bytes((len(PALETTE),)) + rgb6 + bytes(len(PALETTE) * 2))
    for x, y, image in pictures:
        out.extend(b'PICT')
        out.extend(struct.pack('<HHH', y * 320 + x, image.height, image.width))
        out.extend(lzs_literals(image.tobytes()))
    return bytes(out)


def screen(title: str, subtitle: str = '') -> Image.Image:
    image = Image.new('P', (320, 200), 1)
    d = ImageDraw.Draw(image)
    d.rectangle((5, 5, 314, 194), outline=3, width=2)
    for y in range(22, 184, 14):
        d.line((14, y, 305, y), fill=2)
    d.rectangle((18, 48, 301, 150), fill=2, outline=5, width=2)
    text(image, 35, 67, title, 6, 2)
    text(image, 45, 119, subtitle, 5, 2)
    return image


def menu_box(selected: int) -> Image.Image:
    image = Image.new('P', (68, 57), 2)
    d = ImageDraw.Draw(image)
    d.rectangle((0, 0, 67, 56), outline=5, width=2)
    for row, label in enumerate(('PLAY', 'SET', 'HELP')):
        y = 7 + row * 16
        if row == selected:
            d.rectangle((5, y - 2, 62, y + 13), fill=3)
        text(image, 10, y, label, 6, 2)
    return image


def go_menu() -> Image.Image:
    image = screen('CHOOSE ROAD', 'ARROWS THEN JUMP')
    d = ImageDraw.Draw(image)
    d.rectangle((10, 23, 309, 183), fill=2, outline=5)
    for road in range(30):
        column, row = divmod(road, 15)
        x = 24 + column * 152
        y = 30 + row * 10
        text(image, x, y, f'ROAD {road + 1:02}', 6, 1)
    return image


def ship_strip() -> Image.Image:
    image = Image.new('P', (24, 2310), 0)
    d = ImageDraw.Draw(image)
    for frame in range(77):
        y = frame * 30
        tint = (3, 5, 6, 4)[frame % 4]
        d.polygon(((12, y + 2), (20, y + 24), (12, y + 19), (4, y + 24)), fill=tint)
        d.polygon(((12, y + 7), (15, y + 18), (9, y + 18)), fill=6)
        d.line((5, y + 24, 19, y + 24), fill=4)
    return image


def world(index: int) -> Image.Image:
    image = Image.new('P', (320, 138), 1)
    d = ImageDraw.Draw(image)
    d.rectangle((0, 83, 319, 137), fill=2)
    for star in range(55):
        x = (star * 79 + index * 37) % 320
        y = (star * 47 + index * 13) % 80
        d.point((x, y), fill=6 if star % 5 == 0 else 3)
    for ridge in range(0, 320, 8):
        height = 18 + ((ridge * 3 + index * 11) % 27)
        d.line((ridge, 138 - height, ridge + 8, 138 - height - ((ridge // 8) % 3) * 3), fill=3)
    return image


def make_files() -> dict[str, bytes]:
    files = {}
    files['INTRO.LZS'] = gfx([(0, 0, screen('OPEN SKYWAYS', 'INDEPENDENT ART'))])
    files['MAINMENU.LZS'] = gfx([(127, 128, menu_box(n)) for n in range(3)])
    settings = screen('SETTINGS', 'AUDIO DISABLED')
    files['SETMENU.LZS'] = gfx([(0, 0, settings)] + [
        (68, 140, menu_box(n % 3)) for n in range(5)
    ])
    files['HELPMENU.LZS'] = gfx([(0, 0, screen('CONTROLS', line)) for line in (
        'ARROWS MOVE', 'SPACE JUMP', 'ESC BACK')])
    cursor = Image.new('P', (6, 5), 0)
    ImageDraw.Draw(cursor).polygon(((0, 0), (5, 2), (0, 4)), fill=6)
    files['GOMENU.LZS'] = gfx([(0, 0, go_menu()), (0, 0, cursor)])
    files['CARS.LZS'] = gfx([(0, 0, ship_strip())])
    dash = Image.new('P', (320, 71), 2)
    d = ImageDraw.Draw(dash)
    d.rectangle((1, 2, 318, 68), outline=5, width=2)
    text(dash, 11, 22, 'FUEL', 6, 2)
    text(dash, 116, 22, 'SPEED', 6, 2)
    text(dash, 243, 22, 'AIR', 6, 2)
    files['DASHBRD.LZS'] = gfx([(0, 129, dash)])
    for index in range(10):
        files[f'WORLD{index}.LZS'] = gfx([(0, 0, world(index))])
    return files


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('directory', type=Path)
    args = parser.parse_args()
    args.directory.mkdir(parents=True, exist_ok=True)
    files = make_files()
    for name, data in files.items():
        (args.directory / name).write_bytes(data)
    manifest = {
        'status': 'experimental independent graphics, not a playable release',
        'license': 'CC0-1.0',
        'source_revision': 'haroldo-ok/skyroads-32x@df219e03b854153291b32224593013b60d861d40',
        'files': {name: {'size': len(data), 'sha256': hashlib.sha256(data).hexdigest()} for name, data in files.items()},
    }
    (args.directory / 'visuals.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
    print(f'wrote {len(files)} independent graphics containers to {args.directory}')
