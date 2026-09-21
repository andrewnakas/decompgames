#!/usr/bin/env python3
"""Experimental data-free build; activate Emscripten 4.0.10, pass checkout and output."""
import hashlib
import json
from pathlib import Path
import subprocess
import sys

repo, out = [Path(p).resolve() for p in sys.argv[1:]]
revision = 'fbbb3f967a51fafe642e6140d0753979e73b4090'
assert subprocess.check_output(['git', '-C', str(repo), 'rev-parse', 'HEAD'], text=True).strip() == revision
subprocess.run(['git', '-C', str(repo), 'diff', '--exit-code', 'HEAD', '--', 'src', 'snes', 'third_party'], check=True)
version = subprocess.check_output(['emcc', '--version'], text=True).splitlines()[0]
assert '4.0.10' in version
out.mkdir(parents=True, exist_ok=True)
main = repo / 'src/main.c'
code = main.read_text()
assert code.count('SDL_Delay(') == 2
patched = out / 'main-browser.c'
patched.write_text('#include <emscripten.h>\n' + code.replace('SDL_Delay(', 'emscripten_sleep('))
sources = [p for p in sorted((repo / 'src').glob('*.c')) if p != main]
sources += sorted((repo / 'snes').glob('*.c'))
extra_patches = []
for relative, before in [('src/zelda_rtl.c', 'ppu_init(NULL)'), ('snes/snes.c', 'ppu_init(snes)')]:
    source = repo / relative
    original = source.read_text()
    assert original.count(before) == 1
    target = out / (source.stem + '-browser.c')
    target.write_text(original.replace(before, 'ppu_init()'))
    sources[sources.index(source)] = target
    extra_patches.append(target.name)
sources += [repo / 'third_party/gl_core/gl_core_3_1.c', repo / 'third_party/opus-1.3.1-stripped/opus_decoder_amalgam.c', patched]
flags = ['-O2', '-I', str(repo), '-iquote', str(repo / 'src'), '-iquote', str(repo / 'snes'), '-sUSE_SDL=2',
         '-DSYSTEM_VOLUME_MIXER_AVAILABLE=0', '-sASYNCIFY=1', '-sALLOW_MEMORY_GROWTH=1',
         '-sEXIT_RUNTIME=1', '-sFORCE_FILESYSTEM=1',
         '-sEXPORTED_RUNTIME_METHODS=FS,IDBFS,addRunDependency,removeRunDependency', '-lidbfs.js']
subprocess.run(['emcc', *map(str, sources), *flags, '-o', str(out / 'zelda3.js')], check=True)
files = []
for name in ['zelda3.js', 'zelda3.wasm', 'main-browser.c', *extra_patches]:
    data = (out / name).read_bytes()
    files.append({'path': name, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
record = {'revision': revision, 'toolchain': version, 'flags': flags, 'assetsBundled': False, 'browserTested': False, 'files': files}
(out / 'build-record.json').write_text(json.dumps(record, indent=2) + '\n')
print(json.dumps(files, indent=2))
