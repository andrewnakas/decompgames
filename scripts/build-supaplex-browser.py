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
import shutil

REVISION = 'bad56a4e174e628643995284ea55d4c49af3137c'
arguments = sys.argv[1:]
replacement_pack = '--replacement-pack' in arguments
arguments = [p for p in arguments if p != '--replacement-pack']
repo, output = (Path(p).resolve() for p in arguments)
revision = subprocess.check_output(['git', '-C', str(repo), 'rev-parse', 'HEAD'], text=True).strip()
if revision != REVISION:
    raise SystemExit('Unexpected source revision')
version = subprocess.check_output(['emcc', '--version'], text=True).splitlines()[0]
if '4.0.10' not in version:
    raise SystemExit('This recipe requires Emscripten 4.0.10')
# Reject edited C sources: the patch below must be the complete engine change.
subprocess.run(['git', '-C', str(repo), 'diff', '--exit-code', 'HEAD', '--', 'src'], check=True)
output.mkdir(parents=True, exist_ok=True)
if replacement_pack:
    # Isolated engine sources: original checkout and assets remain untouched.
    source_root = output / 'replacement-source'
    shutil.copytree(repo / 'src', source_root / 'src', dirs_exist_ok=True)
    repo = source_root
    header = repo / 'src/globals.h'
    text = header.read_text()
    assert text.count('#define kNumberOfLevels 111') == 1
    text = text.replace('#define kNumberOfLevels 111', '#define kNumberOfLevels 6')
    # Player files are fixed 128-byte records regardless of the new campaign length.
    assert text.count('uint8_t levelState[kNumberOfLevels];') == 1
    text = text.replace('uint8_t levelState[kNumberOfLevels];', 'uint8_t levelState[111];')
    header.write_text(text)
    main = repo / 'src/supaplex.c'
    text = main.read_text()
    assert text.count('YOU HAVE COMPLETED ALL 111 LEVELS OF SUPAPLEX') == 1
    main.write_text(text.replace('YOU HAVE COMPLETED ALL 111 LEVELS OF SUPAPLEX', 'YOU HAVE COMPLETED ALL SIX OPEN PATHS'))
    graphics = repo / 'src/graphics.c'
    text = graphics.read_text()
    colors = ['101722','8995a8','223851','397faf','51c4d5','75e5d1','ffc36b','ed805e','485c73','7994b5','e3f2ff','ff718c','956ed9','cadc81','69a2fa','ffffff']
    values = [v for color in colors for v in [int(color[0:2],16)>>4,int(color[2:4],16)>>4,int(color[4:6],16)>>4,15]]
    import re
    for name in ['gTitlePaletteData','gTitle1PaletteData','gTitle2PaletteData']:
        text, count = re.subn(r'ColorPaletteData '+name+r' = \{.*?\};', 'ColorPaletteData '+name+' = {'+', '.join(map(str,values))+'};', text, count=1, flags=re.S)
        assert count == 1
    graphics.write_text(text)
system = repo / 'src/sdl_common/system.c'
original = system.read_text()
needle = 'void handleSystemEvents()\n{'
if original.count(needle) != 1 or original.count('    SDL_Delay(time);') != 1:
    raise SystemExit('Upstream event-loop source no longer matches the patch')
patched = '#include <emscripten.h>\n' + original.replace(
    needle, needle + '\n    // Yield nested polling loops to browser input and painting.\n    emscripten_sleep(1);'
).replace('    SDL_Delay(time);', '    emscripten_sleep(time);')
event_needle = '        while (SDL_PollEvent(&event))\n        {'
if patched.count(event_needle) != 1:
    raise SystemExit('Upstream SDL event polling no longer matches')
patched = patched.replace('void initializeSystem(void)',
    'Uint8 browserKeyPresses[SDL_NUM_SCANCODES] = {0};\nUint32 browserMousePresses = 0;\nint browserMouseX = 0, browserMouseY = 0;\n\nvoid initializeSystem(void)')
patched = patched.replace(event_needle, event_needle + '''
            // Retain taps whose key-up arrives before the next state sample.
            if (event.type == SDL_KEYDOWN && event.key.keysym.scancode > SDL_SCANCODE_UNKNOWN
                && event.key.keysym.scancode < SDL_NUM_SCANCODES)
                browserKeyPresses[event.key.keysym.scancode] = 1;
            if (event.type == SDL_MOUSEBUTTONDOWN &&
                (event.button.button == SDL_BUTTON_LEFT || event.button.button == SDL_BUTTON_RIGHT)) {
                browserMousePresses |= SDL_BUTTON(event.button.button);
                browserMouseX = event.button.x;
                browserMouseY = event.button.y;
            }''')
patch_path = output / 'system-browser.c'
patch_path.write_text(patched)
keyboard = repo / 'src/sdl2/keyboard.c'
keyboard_source = keyboard.read_text()
key_needle = '    const Uint8 *keys = SDL_GetKeyboardState(&numberOfKeys);'
if keyboard_source.count(key_needle) != 1:
    raise SystemExit('Upstream keyboard state sampling no longer matches')
keyboard_source = keyboard_source.replace(key_needle, '''    const Uint8 *held = SDL_GetKeyboardState(&numberOfKeys);
    extern Uint8 browserKeyPresses[SDL_NUM_SCANCODES];
    Uint8 keys[SDL_NUM_SCANCODES];
    if (numberOfKeys > SDL_NUM_SCANCODES) numberOfKeys = SDL_NUM_SCANCODES;
    for (int i = 0; i < numberOfKeys; ++i) {
        keys[i] = held[i] || browserKeyPresses[i];
        browserKeyPresses[i] = 0;
    }''')
keyboard_patch = output / 'keyboard-browser.c'
keyboard_patch.write_text(keyboard_source)
video = repo / 'src/sdl2/video.c'
video_source = video.read_text()
mouse_needle = '    Uint32 state = SDL_GetMouseState(x, y);'
if video_source.count(mouse_needle) != 1:
    raise SystemExit('Upstream mouse state sampling no longer matches')
video_source = video_source.replace(mouse_needle, mouse_needle + '''
    extern Uint32 browserMousePresses;
    extern int browserMouseX, browserMouseY;
    if (browserMousePresses) {
        state |= browserMousePresses;
        if (x) *x = browserMouseX;
        if (y) *y = browserMouseY;
        browserMousePresses = 0;
    }''')
video_patch = output / 'video-browser.c'
video_patch.write_text(video_source)
sources = sorted((repo / 'src').glob('*.c'))
sources += [p for p in sorted((repo / 'src/sdl2').glob('*.c')) if p not in (keyboard, video)]
sources += [p for p in sorted((repo / 'src/sdl_common').glob('*.c'))
            if p != system and (not replacement_pack or p.name != 'audio.c')]
sources += [repo / 'src/null/virtualKeyboard.c', repo / 'src/lib/ini/ini.c', patch_path, keyboard_patch, video_patch]
if replacement_pack:
    sources += [repo / 'src/null/audio.c']
flags = ['-O2', '-DHAVE_SDL2', '-DFILE_FHS_XDG_DIRS', '-DFILE_DATA_PATH=/games/supaplex',
         '-iquote', str(system.parent), '-sUSE_SDL=2',
         '-sASYNCIFY=1', '-sALLOW_MEMORY_GROWTH=1', '-sEXIT_RUNTIME=1',
         '-sFORCE_FILESYSTEM=1',
         '-sEXPORTED_RUNTIME_METHODS=FS,IDBFS,addRunDependency,removeRunDependency', '-lidbfs.js']
if not replacement_pack:
    flags += ['-sUSE_SDL_MIXER=2', '-sSDL2_MIXER_FORMATS=mod']
command = ['emcc', *map(str, sources), *flags, '-o', str(output / 'supaplex.js')]
subprocess.run(command, check=True)
files = []
record_paths = ['supaplex.js', 'supaplex.wasm', 'system-browser.c', 'keyboard-browser.c', 'video-browser.c']
if replacement_pack:
    record_paths += ['replacement-source/src/globals.h', 'replacement-source/src/supaplex.c', 'replacement-source/src/graphics.c']
for name in record_paths:
    data = (output / name).read_bytes()
    files.append({'path': name, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
(output / 'build-record.json').write_text(json.dumps({
    'sourceRevision': REVISION, 'toolchain': version, 'flags': flags,
    'assetsBundled': False, 'browserTested': False, 'files': files,
    'replacementPack': replacement_pack, 'campaignLevels': 6 if replacement_pack else 111,
    'audioBackend': 'null' if replacement_pack else 'SDL2_mixer',
}, indent=2) + '\n')
print(json.dumps(files, indent=2))
