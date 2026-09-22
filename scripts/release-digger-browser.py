#!/usr/bin/env python3
"""Package the audited Digger replacement build for the shared player."""
import hashlib
import io
import json
from pathlib import Path
import shutil
import sys
import tarfile

if len(sys.argv) != 2:
    raise SystemExit('Usage: release-digger-browser.py BUILD_OUTPUT')

workspace = Path(__file__).resolve().parent.parent
build = Path(sys.argv[1]).resolve()
record = json.loads((build / 'build-record.json').read_text())
if record.get('sourceRevision') != 'e85cab1164f0304b3e66f371a5997d83f7a0090a':
    raise SystemExit('Unexpected Digger source revision')
if record.get('originalGraphicsStillEmbedded') or record.get('originalFontStillEmbedded'):
    raise SystemExit('Replacement graphics and font are required')
if not record.get('remainingDataAuditComplete') or record.get('sdlSoundFeatureDefined'):
    raise SystemExit('Static-data audit and no-audio build are required')

web_dist = build / 'source' / 'web-dist'
files = []
for name in ('digger.js', 'digger.wasm'):
    data = (web_dist / name).read_bytes()
    files.append({'path': name, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
package_digest = hashlib.sha256(json.dumps(files, separators=(',', ':')).encode()).hexdigest()[:10]
package_revision = f"{record['sourceRevision'][:12]}-{package_digest}"
base = f'/runtime/digger/{package_revision}/'
runtime_dir = workspace / 'public' / base.lstrip('/')
runtime_dir.mkdir(parents=True, exist_ok=True)
for item in files:
    shutil.copyfile(web_dist / item['path'], runtime_dir / item['path'])

source_name = f'digger-{package_revision}'
source_path = workspace / 'public' / 'sources' / f'{source_name}.tar.gz'
source_path.parent.mkdir(parents=True, exist_ok=True)
excluded_names = {'web-dist', 'digger.html', 'digger.js', 'digger.wasm'}
excluded_suffixes = {'.o', '.a'}
with tarfile.open(source_path, 'w:gz', compresslevel=9) as archive:
    source_root = build / 'source'
    for path in sorted(source_root.rglob('*')):
        relative = path.relative_to(source_root)
        if any(part in excluded_names for part in relative.parts):
            continue
        if path.is_dir() or path.suffix in excluded_suffixes:
            continue
        archive.add(path, arcname=f'{source_name}/upstream/{relative}')
    for relative in (
        'scripts/build-digger-browser.py',
        'scripts/generate-open-digger-levels.mjs',
        'scripts/generate-open-digger-graphics.py',
        'scripts/generate-open-digger-font.py',
        'docs/digger-data-audit.md',
        'docs/digger-replacement-integration.md',
    ):
        archive.add(workspace / relative, arcname=f'{source_name}/decompgames/{relative}')
    instructions = (
        f"Upstream: https://github.com/sobomax/digger\n"
        f"Revision: {record['sourceRevision']}\n"
        f"Toolchain: {record['toolchain']}\n"
        "The upstream/ directory is the exact patched source used for the distributed WASM.\n"
        "The decompgames/ directory contains the reproducible build and replacement-data generators.\n"
        "Run the generators, then pass their outputs to build-digger-browser.py as documented in the repository.\n"
    ).encode()
    info = tarfile.TarInfo(f'{source_name}/BUILD-DECOMPGAMES.txt')
    info.size = len(instructions)
    archive.addfile(info, io.BytesIO(instructions))

source_data = source_path.read_bytes()
manifest = {
    'id': 'digger',
    'engine': 'digger',
    'packageRevision': package_revision,
    'sourceRevision': record['sourceRevision'],
    'repository': 'https://github.com/sobomax/digger',
    'toolchain': record['toolchain'],
    'recipe': 'scripts/build-digger-browser.py',
    'sourceArchive': f'/sources/{source_path.name}',
    'sourceArchiveSha256': hashlib.sha256(source_data).hexdigest(),
    'sourceArchiveBytes': len(source_data),
    'requirements': ['WebAssembly', 'Keyboard'],
    'files': files,
    'base': base,
    'script': 'digger.js',
    'saveVersion': 'replacement-v1',
    'saveRoots': ['/home/web_user'],
    'mountSave': True,
    'assets': [],
    'args': ['/Q'],
    'replacementData': {
        'license': 'CC0-1.0',
        'levels': record['replacementLevels'],
        'visualSources': record['generatedVisualSources'],
        'fontSource': record['generatedFontSource'],
    },
}
(workspace / 'public' / 'manifests' / 'digger.json').write_text(json.dumps(manifest, indent=2) + '\n')
print(json.dumps(manifest, indent=2))
