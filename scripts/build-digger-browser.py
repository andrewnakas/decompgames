#!/usr/bin/env python3
"""Build the pinned Digger WASM engine with independent replacement data.

The output remains an internal experiment until the recorded data audit and
gameplay verification gates are complete.
"""
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys

REVISION = 'e85cab1164f0304b3e66f371a5997d83f7a0090a'
if len(sys.argv) not in (4, 5):
    raise SystemExit('Usage: build-digger-browser.py CHECKOUT OUTPUT OPEN_LEVELS_INC [GENERATED_GRAPHICS_DIR]')
checkout, output, level_file = (Path(value).resolve() for value in sys.argv[1:4])
graphics_dir = Path(sys.argv[4]).resolve() if len(sys.argv) == 5 else None
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

# Compile the upstream no-audio branches instead of the SDL audio feature.
# This makes silent testing structural rather than a runtime preference and
# preprocesses the upstream tune tables out of the distributed WASM.
makefile = source / 'GNUmakefile'
make_text = makefile.read_text()
if make_text.count('-D_SDL_SOUND') != 1:
    raise SystemExit('Pinned GNUmakefile sound flag changed')
make_text = make_text.replace('-D_SDL_SOUND ', '')
makefile.write_text(make_text)

# Replace upstream-facing shell branding and remove audio controls that cannot
# work in this intentionally silent build.
shell = source / 'shell.html'
shell_text = shell.read_text()
shell_replacements = {
    '<title>D I G G E R</title>': '<title>Open Digger replacement prototype</title>',
    '<div class="title">D I G G E R</div>': '<div class="title">OPEN DIGGER</div>',
    '<div class="subtitle">REMASTERED &mdash; WINDMILL SOFTWARE 1983</div>':
        '<div class="subtitle">INDEPENDENT REPLACEMENT-DATA PROTOTYPE</div>',
    '        <span class="key">F7</span> <span class="label">Music On/Off</span><br>\n'
    '        <span class="key">F9</span> <span class="label">Sound On/Off</span><br>\n': '',
}
for old, new in shell_replacements.items():
    if shell_text.count(old) != 1:
        raise SystemExit('Pinned shell branding or controls changed')
    shell_text = shell_text.replace(old, new)
shell.write_text(shell_text)
generated_visuals = []
generated_font = None
if graphics_dir:
    manifest = json.loads((graphics_dir / 'manifest.json').read_text())
    if manifest.get('license') != 'CC0-1.0' or manifest.get('originalAssetsUsed') is not False:
        raise SystemExit('Generated visual-data provenance check failed')
    for record in manifest['files']:
        name = record['name']
        if name not in {'cgagrafx.c', 'vgagrafx.c', 'title_gz.c', 'icon.c'}:
            raise SystemExit('Unexpected generated visual-data file')
        data = (graphics_dir / name).read_bytes()
        if len(data) != record['bytes'] or hashlib.sha256(data).hexdigest() != record['sha256']:
            raise SystemExit('Generated visual-data checksum mismatch')
        (source / name).write_bytes(data)
        generated_visuals.append(record)
    font_manifest_path = graphics_dir / 'manifest-font.json'
    if font_manifest_path.exists():
        font_manifest = json.loads(font_manifest_path.read_text())
        record = font_manifest.get('file', {})
        data = (graphics_dir / 'alpha.c').read_bytes()
        if font_manifest.get('license') != 'CC0-1.0' or font_manifest.get('originalAssetsUsed') is not False \
                or len(data) != record.get('bytes') or hashlib.sha256(data).hexdigest() != record.get('sha256'):
            raise SystemExit('Generated font provenance check failed')
        (source / 'alpha.c').write_bytes(data)
        generated_font = record

toolchain = subprocess.check_output(['emcc', '--version'], text=True).splitlines()[0]
subprocess.run(['make', 'clean'], cwd=source, check=True, stdout=subprocess.DEVNULL)
subprocess.run(['make', 'ARCH=WASM', '-j2'], cwd=source, check=True)

# Force upstream quiet mode before any browser launch. This is both a safe
# development default and required by the user's silent-testing instruction.
html_path = source / 'web-dist' / 'digger.html'
html = html_path.read_text()
marker = '    var Module = {\n'
if html.count(marker) != 1:
    raise SystemExit('Pinned shell Module initializer changed')
html_path.write_text(html.replace(marker, marker + "      arguments: ['/Q'],\n"))

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
    'generatedVisualSources': generated_visuals,
    'generatedFontSource': generated_font,
    'files': files,
    'browserTested': False,
    'forcedArguments': ['/Q'],
    'sdlSoundFeatureDefined': False,
    'upstreamTuneTablesCompiled': False,
    'releaseReady': False,
    'originalGraphicsStillEmbedded': not bool(graphics_dir),
    'originalFontStillEmbedded': generated_font is None,
    'remainingDataAuditComplete': False,
    'blockers': [
        *([] if graphics_dir else ['Replace cgagrafx.c, vgagrafx.c, title_gz.c and icon.c']),
        *([] if generated_font else ['Replace or clear the alpha.c text/font data after a format audit']),
        'Finish the audit of remaining embedded non-audio data',
        'Complete muted gameplay and persistence verification',
    ],
}
output.mkdir(parents=True, exist_ok=True)
(output / 'build-record.json').write_text(json.dumps(record, indent=2) + '\n')
print(json.dumps(record, indent=2))
