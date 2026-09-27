#!/usr/bin/env python3
"""Stage and optionally compile a silent, clean-data SkyRoads browser experiment.

This recipe is *not* a release recipe yet: no gameplay or persistence gate has
passed. It deliberately copies only source directories and generated data.
"""
import argparse
import hashlib
import json
import shutil
import subprocess
from pathlib import Path


PIN = 'df219e03b854153291b32224593013b60d861d40'
DATA = (
    'ANIM.LZS', 'CARS.LZS', 'DASHBRD.LZS', 'DEMO.REC', 'FUL_DISP.DAT',
    'GOMENU.LZS', 'HELPMENU.LZS', 'INTRO.LZS', 'INTRO.SND', 'MAINMENU.LZS',
    'OXY_DISP.DAT', 'ROADS.LZS', 'SETMENU.LZS', 'SPEED.DAT', 'TREKDAT.LZS',
    *(f'WORLD{i}.LZS' for i in range(10)),
)


def check_source(source: Path) -> None:
    revision = subprocess.check_output(['git', '-C', str(source), 'rev-parse', 'HEAD'], text=True).strip()
    if revision != PIN:
        raise ValueError(f'Expected upstream {PIN}, got {revision}')


def patch_shell(source: Path) -> None:
    path = source / 'src/platform/sdl/main_sdl.c'
    body = path.read_text(encoding='utf-8')
    before = '''    a->audio = sr_audio_create();
    a->cur_song = -1;
    SDL_AudioSpec want, have;
    SDL_zero(want);
    want.freq = SR_AUDIO_RATE;
    want.format = AUDIO_S16SYS;
    want.channels = 2;
    want.samples = 1024;
    want.callback = audio_cb;
    want.userdata = a;
    a->adev = SDL_OpenAudioDevice(NULL, 0, &want, &have, 0);
    if (a->adev)
        SDL_PauseAudioDevice(a->adev, 0);'''
    after = '''    /* Clean-data experiment: never create or unpause an audio device. */
    a->audio = NULL;
    a->adev = 0;
    a->cur_song = -1;'''
    if body.count(before) != 1:
        raise ValueError('Pinned audio initialization block changed upstream')
    body = body.replace(before, after)
    if body.count('SDL_Init(SDL_INIT_VIDEO | SDL_INIT_AUDIO)') != 1:
        raise ValueError('Pinned SDL initialization block changed upstream')
    body = body.replace('SDL_Init(SDL_INIT_VIDEO | SDL_INIT_AUDIO)', 'SDL_Init(SDL_INIT_VIDEO)')
    browser_setup = '''#ifdef __EMSCRIPTEN__
    snprintf(data_dir, sizeof data_dir, "/data");
#endif'''
    browser_setup_after = '''#ifdef __EMSCRIPTEN__
    snprintf(data_dir, sizeof data_dir, "/data");
    snprintf(pref_dir, sizeof pref_dir, "/save");
#endif'''
    if body.count(browser_setup) != 1:
        raise ValueError('Pinned browser data path changed upstream')
    body = body.replace(browser_setup, browser_setup_after)
    write_return = '''        if (n == size)
            return true;'''
    write_return_after = '''        if (n == size) {
#ifdef __EMSCRIPTEN__
            EM_ASM({ FS.syncfs(false, function(err) {
                if (err) console.error('Open Skyways save sync failed', err);
            }); });
#endif
            return true;
        }'''
    if body.count(write_return) != 1:
        raise ValueError('Pinned file write block changed upstream')
    body = body.replace(write_return, write_return_after)
    write_dirs = 'const char *dirs[2] = { data_dir, pref_dir };'
    if body.count(write_dirs) != 1:
        raise ValueError('Pinned file write directories changed upstream')
    body = body.replace(write_dirs, 'const char *dirs[2] = { pref_dir, data_dir };')
    if body.count('SDL_CreateWindow("SkyRoads"') != 1:
        raise ValueError('Pinned SDL title changed upstream')
    body = body.replace('SDL_CreateWindow("SkyRoads"', 'SDL_CreateWindow("Open Skyways"')
    path.write_text(body, encoding='utf-8')


def stage(source: Path, output: Path, roads: Path, visuals: Path, support: Path) -> None:
    check_source(source)
    if output.exists():
        raise FileExistsError(f'Refusing to overwrite {output}')
    src = output / 'source'
    src.mkdir(parents=True)
    shutil.copy2(source / 'CMakeLists.txt', src / 'CMakeLists.txt')
    shutil.copy2(source / 'LICENSE', src / 'LICENSE')
    for relative in ('src/core', 'src/platform/sdl', 'src/thirdparty'):
        shutil.copytree(source / relative, src / relative)
    patch_shell(src)
    cmake = src / 'CMakeLists.txt'
    cmake_body = cmake.read_text(encoding='utf-8')
    cmake_before = 'LINK_FLAGS "-sUSE_SDL=2 -sALLOW_MEMORY_GROWTH=1 ${PRELOAD}"'
    cmake_after = 'LINK_FLAGS "-sUSE_SDL=2 -sALLOW_MEMORY_GROWTH=1 -sFORCE_FILESYSTEM=1 -sEXPORTED_RUNTIME_METHODS=FS,IDBFS -lidbfs.js --pre-js ${CMAKE_SOURCE_DIR}/open_skyways_pre.js ${PRELOAD}"'
    if cmake_body.count(cmake_before) != 1:
        raise ValueError('Pinned web linker flags changed upstream')
    cmake.write_text(cmake_body.replace(cmake_before, cmake_after), encoding='utf-8')
    (src / 'open_skyways_pre.js').write_text('''// Mount private browser storage and load prior progress before main().
Module.preRun = Module.preRun || [];
Module.preRun.push(function () {
  FS.mkdir('/save');
  FS.mount(IDBFS, {}, '/save');
  addRunDependency('open-skyways-saves');
  FS.syncfs(true, function (error) {
    if (error) console.error('Open Skyways save load failed', error);
    removeRunDependency('open-skyways-saves');
  });
});
''', encoding='utf-8')
    locations = [roads, visuals, support]
    entries = []
    for name in DATA:
        matches = [folder / name for folder in locations if (folder / name).is_file()]
        if len(matches) != 1:
            raise ValueError(f'Expected exactly one independent replacement for {name}, found {len(matches)}')
        data = matches[0].read_bytes()
        if not data:
            raise ValueError(f'Empty replacement file: {name}')
        (src / name).write_bytes(data)
        entries.append({'path': name, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
    present = sorted(path.name for path in src.iterdir() if path.suffix.upper() in ('.LZS', '.DAT', '.REC', '.SND'))
    if present != sorted(DATA):
        raise AssertionError('Unexpected data in staged source')
    record = {
        'status': 'experimental, untested browser build inputs; do not publish',
        'upstream': 'https://github.com/haroldo-ok/skyroads-32x',
        'upstreamRevision': PIN,
        'codeLicense': 'MIT (third-party files retain their own licenses)',
        'replacementLicense': 'CC0-1.0 independently authored',
        'audio': 'SDL audio subsystem and device omitted; no music or SFX files packaged',
        'persistence': 'IDBFS /save mounted before main; cfg writes sync to IndexedDB',
        'replacements': entries,
    }
    (output / 'build-record.json').write_text(json.dumps(record, indent=2) + '\n', encoding='utf-8')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('output', type=Path)
    parser.add_argument('roads', type=Path)
    parser.add_argument('visuals', type=Path)
    parser.add_argument('support', type=Path)
    parser.add_argument('--prepare-only', action='store_true')
    args = parser.parse_args()
    stage(args.source.resolve(), args.output.resolve(), args.roads.resolve(), args.visuals.resolve(), args.support.resolve())
    if not args.prepare_only:
        subprocess.run(['emcmake', 'cmake', '-S', str(args.output / 'source'),
                        '-B', str(args.output / 'build'), '-DCMAKE_BUILD_TYPE=Release'], check=True)
        subprocess.run(['cmake', '--build', str(args.output / 'build'), '--parallel'], check=True)
    print(f'Staged {len(DATA)} independent data files with null-audio shell at {args.output}')
