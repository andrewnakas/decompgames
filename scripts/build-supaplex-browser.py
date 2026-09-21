#!/usr/bin/env python3
"""Build an experimental, data-free OpenSupaplex browser engine.

Run under an activated Emscripten 4.0.10 environment:
  python3 build-supaplex-browser.py CHECKOUT OUTPUT_DIRECTORY
No game resources are preloaded or published. Browser testing is still required.
"""
import hashlib
import json
from pathlib import Path
import subprocess
import sys

REVISION = 'bad56a4e174e628643995284ea55d4c49af3137c'
repo, output = (Path(p).resolve() for p in sys.argv[1:])
revision = subprocess.check_output(['git', '-C', str(repo), 'rev-parse', 'HEAD'], text=True).strip()
if revision != REVISION:
    raise SystemExit('Unexpected source revision')
version = subprocess.check_output(['emcc', '--version'], text=True).splitlines()[0]
if '4.0.10' not in version:
    raise SystemExit('This recipe requires Emscripten 4.0.10')
# Reject edited C sources: the patch below must be the complete engine change.
subprocess.run(['git', '-C', str(repo), 'diff', '--exit-code', 'HEAD', '--', 'src'], check=True)
output.mkdir(parents=True, exist_ok=True)
system = repo / 'src/sdl_common/system.c'
original = system.read_text()
needle = 'void handleSystemEvents()\n{'
if original.count(needle) != 1 or original.count('    SDL_Delay(time);') != 1:
    raise SystemExit('Upstream event-loop source no longer matches the patch')
patched = '#include <emscripten.h>\n' + original.replace(
    needle, needle + '\n    // Yield nested polling loops to browser input and painting.\n    emscripten_sleep(1);'
).replace('    SDL_Delay(time);', '    emscripten_sleep(time);')
patch_path = output / 'system-browser.c'
patch_path.write_text(patched)
sources = sorted((repo / 'src').glob('*.c'))
sources += sorted((repo / 'src/sdl2').glob('*.c'))
sources += [p for p in sorted((repo / 'src/sdl_common').glob('*.c')) if p != system]
sources += [repo / 'src/null/virtualKeyboard.c', repo / 'src/lib/ini/ini.c', patch_path]
flags = ['-O2', '-DHAVE_SDL2', '-DFILE_FHS_XDG_DIRS', '-DFILE_DATA_PATH=/games/supaplex',
         '-iquote', str(system.parent), '-sUSE_SDL=2', '-sUSE_SDL_MIXER=2',
         '-sASYNCIFY=1', '-sALLOW_MEMORY_GROWTH=1', '-sEXIT_RUNTIME=1',
         '-sFORCE_FILESYSTEM=1',
         '-sEXPORTED_RUNTIME_METHODS=FS,IDBFS,addRunDependency,removeRunDependency', '-lidbfs.js']
command = ['emcc', *map(str, sources), *flags, '-o', str(output / 'supaplex.js')]
subprocess.run(command, check=True)
files = []
for name in ['supaplex.js', 'supaplex.wasm', 'system-browser.c']:
    data = (output / name).read_bytes()
    files.append({'path': name, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
(output / 'build-record.json').write_text(json.dumps({
    'sourceRevision': REVISION, 'toolchain': version, 'flags': flags,
    'assetsBundled': False, 'browserTested': False, 'files': files,
}, indent=2) + '\n')
print(json.dumps(files, indent=2))
