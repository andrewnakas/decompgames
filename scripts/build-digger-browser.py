#!/usr/bin/env python3
"""Build the pinned Digger WASM engine with independently authored levels.

This remains an internal experiment: upstream embedded graphics/title/icon data
are still present and the resulting binary must not be published as a clean
replacement build.
"""
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys

REVISION = 'e85cab1164f0304b3e66f371a5997d83f7a0090a'
if len(sys.argv) != 4:
    raise SystemExit('Usage: build-digger-browser.py CHECKOUT OUTPUT OPEN_LEVELS_INC')
checkout, output, level_file = (Path(value).resolve() for value in sys.argv[1:])
revision = subprocess.check_output(['git', '-C', str(checkout), 'rev-parse', 'HEAD'], text=True).strip()
if revision != REVISION:
    raise SystemExit('Unexpected Digger source revision')
subprocess.run(['git', '-C', str(checkout), 'diff', '--exit-code', 'HEAD'], check=True)
if output.exists():
    raise SystemExit('Choose a new output directory')

source = output / 'source'
shutil.copytree(checkout, source, ignore=shutil.ignore_patterns(
    '.git', '*.o', 'web-dist', 'digger.html', 'digger.js', 'digger.wasm'))
levels = level_file.read_text().strip()
game = source / 'game.c'
text = game.read_text()
start = text.index('  .leveldat = ')
end = text.index('\n};', start)
game.write_text(text[:start] + '  .leveldat = ' + levels + text[end:])

toolchain = subprocess.check_output(['emcc', '--version'], text=True).splitlines()[0]
subprocess.run(['make', 'clean'], cwd=source, check=True, stdout=subprocess.DEVNULL)
subprocess.run(['make', 'ARCH=WASM', '-j2'], cwd=source, check=True)

files = []
for name in ('digger.js', 'digger.wasm', 'digger.html', 'digger-build-info.js'):
    path = source / 'web-dist' / name
    data = path.read_bytes()
    files.append({'path': name, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
level_bytes = level_file.read_bytes()
record = {
    'sourceRevision': REVISION,
    'toolchain': toolchain,
    'replacementLevels': {'bytes': len(level_bytes), 'sha256': hashlib.sha256(level_bytes).hexdigest()},
    'files': files,
    'browserTested': False,
    'releaseReady': False,
    'originalGraphicsStillEmbedded': True,
    'blockers': [
        'Replace cgagrafx.c and vgagrafx.c with independently authored graphics',
        'Replace title_gz.c and icon.c',
        'Audit generated audio behavior and all remaining embedded data',
        'Complete muted gameplay and persistence verification',
    ],
}
output.mkdir(parents=True, exist_ok=True)
(output / 'build-record.json').write_text(json.dumps(record, indent=2) + '\n')
print(json.dumps(record, indent=2))
