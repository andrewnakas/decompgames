#!/usr/bin/env python3
"""Generate deliberately simple, independent Digger-compatible visual data.

The pinned source files are read only for C symbol names, array lengths, and
pointer-table order. Original initializer values are counted but never reused.
"""
import hashlib
import json
from pathlib import Path
import re
import sys
import zlib

if len(sys.argv) != 3:
    raise SystemExit('Usage: generate-open-digger-graphics.py PINNED_CHECKOUT OUTPUT')
source, output = (Path(value).resolve() for value in sys.argv[1:])
output.mkdir(parents=True, exist_ok=True)

def c_bytes(values, columns=24):
    chunks = [','.join(f'0x{value:02x}' for value in values[i:i+columns]) for i in range(0, len(values), columns)]
    return ',\n  '.join(chunks)

def generate_table(filename, prefix):
    text = (source / filename).read_text()
    arrays = list(re.finditer(r'static const uint8_t (\w+)\[\]\s*=\s*\{(.*?)\};', text, re.S))
    table = re.search(rf'const uint8_t \*{prefix}table\[\]\s*=\s*\{{(.*?)\}};', text, re.S)
    if len(arrays) != 198 or table is None:
        raise SystemExit(f'Pinned {filename} metadata changed')
    generated = []
    records = []
    for match in arrays:
        name = match.group(1)
        length = len(re.findall(r'0x[0-9a-f]+|\b\d+\b', match.group(2), re.I))
        if not length:
            raise SystemExit(f'Empty metadata array: {name}')
        seed = hashlib.sha256(name.encode()).digest()[0]
        if 'zero' in name:
            values = [0] * length
        elif 'mask' in name:
            # Opaque rectangular placeholder. Distinct silhouettes are added
            # after exact sprite dimensions are mapped in a later art pass.
            values = [0] * length
        elif prefix == 'vga':
            color = 1 + seed % 14
            values = [color if (i // 8 + i % 8) % 5 else 15 for i in range(length)]
        else:
            colors = (0x55, 0xaa, 0xff)
            values = [colors[(seed + i // 4) % len(colors)] for i in range(length)]
        generated.append(f'static const uint8_t {name}[]={{\n  {c_bytes(values)}\n}};')
        records.append({'symbol': name, 'bytes': length})
    table_names = re.findall(rf'\b{prefix}\w+\b', re.sub(r'/\*.*?\*/', '', table.group(1), flags=re.S))
    if len(table_names) != 240 or any(name not in {r['symbol'] for r in records} for name in table_names):
        raise SystemExit(f'Pinned {prefix} pointer table changed')
    body = '// Procedural placeholder graphics, CC0-1.0. No original pixels used.\n#include "def.h"\n\n'
    body += '\n\n'.join(generated)
    body += f'\n\nconst uint8_t *{prefix}table[]={{\n  ' + ',\n  '.join(table_names) + '\n};\n'
    path = output / filename
    path.write_text(body)
    return records, path

cga_records, cga_path = generate_table('cgagrafx.c', 'cga')
vga_records, vga_path = generate_table('vgagrafx.c', 'vga')

# The title loader requires a 640x400 byte-indexed image. Draw an original
# geometric frame and central signal bars, then compress it with zlib.
width, height = 640, 400
title = bytearray(width * height)
for y in range(height):
    for x in range(width):
        border = x < 18 or x >= width-18 or y < 18 or y >= height-18
        bars = 150 <= y < 250 and 110 <= x < 530 and ((x-110)//35) % 2 == 0
        title[y*width+x] = 9 if border else (11 if bars else 1)
compressed = zlib.compress(bytes(title), 9)
title_c = f'''// Procedural title, CC0-1.0.\n#include <assert.h>\n#include <zlib.h>\n#define CTITLELEN {len(compressed)}\n#define UTITLELEN {len(title)}\nstatic const uint8_t title_gz[CTITLELEN]={{\n  {c_bytes(compressed)}\n}};\nvoid gettitle(unsigned char *buf){{uLongf n=UTITLELEN;int r=uncompress(buf,&n,title_gz,CTITLELEN);assert(r==Z_OK);(void)r;}}\n'''
title_path = output / 'title_gz.c'
title_path.write_text(title_c)

icon = []
for y in range(64):
    for x in range(64):
        inside = 8 <= x < 56 and 8 <= y < 56
        color = 0xff69a2fa if inside and ((x//8+y//8)%2) else (0xff101722 if inside else 0x00000000)
        icon.append(color)
icon_path = output / 'icon.c'
icon_path.write_text('// Procedural icon, CC0-1.0.\n#include <SDL.h>\nuint32_t Icon[]={\n  '+',\n  '.join(f'0x{value:08x}' for value in icon)+'\n};\n')

files = []
for path in (cga_path, vga_path, title_path, icon_path):
    data = path.read_bytes()
    files.append({'name': path.name, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
(output / 'manifest.json').write_text(json.dumps({
    'license': 'CC0-1.0', 'originalAssetsUsed': False,
    'sourceMetadataUsed': ['C symbol names', 'array byte lengths', 'pointer-table order'],
    'engineTested': False, 'files': files,
    'limitations': [
        'Placeholder sprites are colored rectangles without final silhouettes',
        'Text/font data in alpha.c and audiovisual behavior still require audit',
        'No gameplay or readability verification has been completed',
    ],
    'symbolCounts': {'cga': len(cga_records), 'vga': len(vga_records)},
}, indent=2) + '\n')
print(f'Generated four independent Digger visual-data sources in {output}.')
