#!/usr/bin/env python3
"""Generate an independent compact font in Digger's CGA/VGA table format."""
import hashlib
import json
from pathlib import Path
import re
import sys

if len(sys.argv) != 3:
    raise SystemExit('Usage: generate-open-digger-font.py PINNED_CHECKOUT OUTPUT')
source, output = (Path(value).resolve() for value in sys.argv[1:])
output.mkdir(parents=True, exist_ok=True)

patterns = {
 '0':'111/101/101/101/111','1':'010/110/010/010/111','2':'110/001/010/100/111','3':'110/001/010/001/110','4':'101/101/111/001/001','5':'111/100/110/001/110','6':'011/100/111/101/111','7':'111/001/010/010/010','8':'111/101/111/101/111','9':'111/101/111/001/110',
 'A':'010/101/111/101/101','B':'110/101/110/101/110','C':'011/100/100/100/011','D':'110/101/101/101/110','E':'111/100/110/100/111','F':'111/100/110/100/100','G':'011/100/101/101/011','H':'101/101/111/101/101','I':'111/010/010/010/111','J':'001/001/001/101/010','K':'101/101/110/101/101','L':'100/100/100/100/111','M':'101/111/111/101/101','N':'101/111/111/111/101','O':'010/101/101/101/010','P':'110/101/110/100/100','Q':'010/101/101/111/011','R':'110/101/110/101/101','S':'011/100/010/001/110','T':'111/010/010/010/010','U':'101/101/101/101/111','V':'101/101/101/101/010','W':'101/101/111/111/101','X':'101/101/010/101/101','Y':'101/101/010/010/010','Z':'111/001/010/100/111',
 '.':'000/000/000/000/010',':':'000/010/000/010/000','_':'000/000/000/000/111',' ':'000/000/000/000/000'
}

def character(name):
    match = re.search(r'(?:let|num)([A-Z0-9])$', name)
    if match: return match.group(1)
    return {'symdot':'.','symcolon':':','symline':'_','symspace':' '}.get(re.sub(r'^(?:cga|vga)','',name),' ')

def bitmap(char, width, height, sx, sy):
    pixels = [0] * (width * height)
    rows = patterns.get(char, patterns[' ']).split('/')
    ox=(width-3*sx)//2; oy=(height-5*sy)//2
    for y,row in enumerate(rows):
        for x,value in enumerate(row):
            if value!='1': continue
            for yy in range(sy):
                for xx in range(sx): pixels[(oy+y*sy+yy)*width+ox+x*sx+xx]=15
    return pixels

text=(source/'alpha.c').read_text()
matches=list(re.finditer(r'static const uint8_t (\w+)\[\]\s*=\s*\{(.*?)\};',text,re.S))
if len(matches)!=80: raise SystemExit('Pinned alpha table shape changed')
declarations=[]
for match in matches:
    name=match.group(1); expected=len(re.findall(r'0x[0-9a-f]+|\b\d+\b',match.group(2),re.I)); char=character(name)
    if name.startswith('cga'):
        raw=bitmap(char,12,12,3,2); data=[]
        for y in range(12):
            for group in range(3):
                byte=0
                for x in range(4): byte|=(3 if raw[y*12+group*4+x] else 0)<<(6-x*2)
                data.append(byte)
    else:
        data=bitmap(char,24,24,6,4)
    if len(data)!=expected: raise SystemExit(f'Unexpected font array length for {name}: {expected}')
    declarations.append(f'static const uint8_t {name}[]={{\n  '+','.join(f'0x{x:02x}' for x in data)+'\n};')

tables=[]
for prefix in ('cga','vga'):
    match=re.search(rf'const uint8_t \* const ascii2{prefix}\[0x5f\]=\{{(.*?)\}};',text,re.S)
    if not match: raise SystemExit('Pinned alpha pointer table changed')
    entries=[value.strip() for value in re.sub(r'/\*.*?\*/','',match.group(1),flags=re.S).split(',') if value.strip()]
    if len(entries)!=95: raise SystemExit('Unexpected alpha pointer count')
    tables.append(f'const uint8_t * const ascii2{prefix}[0x5f]={{\n  '+','.join(entries)+'\n};')

body='// Original compact font, CC0-1.0. No upstream glyph pixels used.\n#include "def.h"\n#include "alpha.h"\n\n'+'\n\n'.join(declarations+tables)+'\n'
path=output/'alpha.c';path.write_text(body);data=path.read_bytes()
(output/'manifest-font.json').write_text(json.dumps({'license':'CC0-1.0','originalAssetsUsed':False,'engineTested':False,'file':{'name':'alpha.c','bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()},'limitations':['Only the engine-supported A–Z, digits, dot, colon, underscore and space are drawn','Browser readability requires verification']},indent=2)+'\n')
print(f'Generated independent Digger font source in {output}.')
