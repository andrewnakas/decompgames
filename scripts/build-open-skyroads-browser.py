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
        'audio': 'SDL_OpenAudioDevice omitted; no music or SFX files packaged',
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
