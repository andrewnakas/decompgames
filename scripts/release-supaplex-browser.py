#!/usr/bin/env python3
"""Package the pinned OpenSupaplex engine with the Open Paths CC0 campaign."""
import hashlib
import io
import json
from pathlib import Path
import shutil
import sys
import tarfile

if len(sys.argv) != 3:
    raise SystemExit('Usage: release-supaplex-browser.py BUILD_OUTPUT OPEN_PATHS_PACKAGE')

workspace = Path(__file__).resolve().parent.parent
build = Path(sys.argv[1]).resolve()
package = Path(sys.argv[2]).resolve()
build_record = json.loads((build / 'build-record.json').read_text())
asset_record = json.loads((package / 'manifest.json').read_text())
revision = 'bad56a4e174e628643995284ea55d4c49af3137c'
if build_record.get('sourceRevision') != revision or asset_record.get('engineSourceRevision') != revision:
    raise SystemExit('Unexpected OpenSupaplex source revision')
if not build_record.get('replacementPack') or build_record.get('campaignLevels') != 6:
    raise SystemExit('Replacement-only six-level build required')
if build_record.get('audioBackend') != 'null':
    raise SystemExit('Open Paths release must use the structural no-audio backend')
if asset_record.get('license') != 'CC0-1.0' or asset_record.get('id') != 'open-paths':
    raise SystemExit('Unexpected replacement-data provenance')

def digest(data):
    return hashlib.sha256(data).hexdigest()

engine_files = []
for name in ('supaplex.js', 'supaplex.wasm'):
    data = (build / name).read_bytes()
    engine_files.append({'path': name, 'bytes': len(data), 'sha256': digest(data)})

assets = []
for item in asset_record['files']:
    name = item['name']
    if '/' in name or '\\' in name:
        raise SystemExit('Unexpected replacement-data path')
    data = (package / 'resources' / name).read_bytes()
    if len(data) != item['bytes'] or digest(data) != item['sha256']:
        raise SystemExit(f'Replacement-data checksum mismatch: {name}')
    assets.append({'path': f'/games/supaplex/{name}', 'url': f'assets/{name}',
                   'bytes': len(data), 'sha256': digest(data)})

package_digest = digest(json.dumps({'engine': engine_files, 'assets': assets},
                                   separators=(',', ':')).encode())[:10]
package_revision = f'{revision[:12]}-{package_digest}'
base = f'/runtime/supaplex/{package_revision}/'
runtime_dir = workspace / 'public' / base.lstrip('/')
(runtime_dir / 'assets').mkdir(parents=True, exist_ok=True)
for item in engine_files:
    shutil.copyfile(build / item['path'], runtime_dir / item['path'])
for item in assets:
    shutil.copyfile(package / 'resources' / Path(item['url']).name,
                    runtime_dir / item['url'])

source_name = f'open-paths-{package_revision}'
source_path = workspace / 'public' / 'sources' / f'{source_name}.tar.gz'
source_path.parent.mkdir(parents=True, exist_ok=True)
with tarfile.open(source_path, 'w:gz', compresslevel=9) as archive:
    source_root = build / 'replacement-source'
    for path in sorted(source_root.rglob('*')):
        if path.is_file() and path.suffix not in {'.o', '.a'}:
            archive.add(path, arcname=f'{source_name}/engine/{path.relative_to(source_root)}')
    for name in ('system-browser.c', 'keyboard-browser.c', 'video-browser.c', 'build-record.json'):
        archive.add(build / name, arcname=f'{source_name}/build-output/{name}')
    for relative in (
        'scripts/build-supaplex-browser.py',
        'scripts/generate-open-font.mjs',
        'scripts/generate-open-tiles.mjs',
        'scripts/generate-open-moving.mjs',
        'scripts/generate-open-screens.mjs',
        'scripts/generate-open-puzzles.mjs',
        'scripts/assemble-open-paths.mjs',
        'scripts/lib/supaplex-planar.mjs',
        'docs/replacement-assets.md',
    ):
        archive.add(workspace / relative, arcname=f'{source_name}/decompgames/{relative}')
    archive.add(package / 'manifest.json', arcname=f'{source_name}/replacement-data/manifest.json')
    instructions = (
        'Engine: https://github.com/sergiou87/open-supaplex\n'
        f'Revision: {revision}\n'
        f"Toolchain: {build_record['toolchain']}\n"
        'The engine/ directory is the exact replacement-build source tree.\n'
        'The build-output/ directory records the generated browser adaptations.\n'
        'Run the CC0 generators, assemble-open-paths.mjs, then build-supaplex-browser.py '
        'with --replacement-pack as documented in the Decomp Games repository.\n'
    ).encode()
    info = tarfile.TarInfo(f'{source_name}/BUILD-DECOMPGAMES.txt')
    info.size = len(instructions)
    archive.addfile(info, io.BytesIO(instructions))

source_data = source_path.read_bytes()
manifest = {
    'id': 'supaplex',
    'engine': 'supaplex',
    'packageRevision': package_revision,
    'sourceRevision': revision,
    'repository': 'https://github.com/sergiou87/open-supaplex',
    'toolchain': build_record['toolchain'],
    'recipe': 'scripts/build-supaplex-browser.py --replacement-pack',
    'sourceArchive': f'/sources/{source_path.name}',
    'sourceArchiveSha256': digest(source_data),
    'sourceArchiveBytes': len(source_data),
    'requirements': ['WebAssembly', 'Keyboard and mouse'],
    'files': engine_files,
    'base': base,
    'script': 'supaplex.js',
    'saveVersion': 'open-paths-1',
    'saveRoots': ['/home/web_user/.local/share/OpenSupaplex'],
    'mountSave': True,
    'assets': assets,
    'args': [],
    'audioBackend': 'null',
    'replacementData': {
        'license': 'CC0-1.0',
        'campaignLevels': 6,
        'scope': asset_record['campaignScope'],
        'manifestSha256': digest((package / 'manifest.json').read_bytes()),
    },
}
(workspace / 'public' / 'manifests' / 'supaplex.json').write_text(json.dumps(manifest, indent=2) + '\n')
print(json.dumps(manifest, indent=2))
