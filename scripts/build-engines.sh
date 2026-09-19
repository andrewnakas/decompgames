#!/usr/bin/env bash
set -euo pipefail
# Use a persistent filesystem: WSL clears /tmp when its VM stops.
ROOT="${DECOMP_BUILD_ROOT:-/home/nakas/decompgames-build}"
source "$ROOT/emsdk/emsdk_env.sh"
case "${1:-}" in
 doom)
  cd "$ROOT/doom"
  cmake -S . -B native -DBUILD_GL=OFF -DWITH_MIXER=OFF -DWITH_IMAGE=OFF -DWITH_NET=OFF
  cmake --build native --target prboomwad -j4
  cp native/prboomx.wad wasm/fs/
  emcmake cmake -S . -B build -DBUILD_GL=OFF -DHAVE_DIRENT_H=1 -DHAVE_UNISTD_H=1 -DCMAKE_BUILD_TYPE=Release '-DCMAKE_EXE_LINKER_FLAGS=-sEXPORTED_RUNTIME_METHODS=FS,IDBFS,callMain -sFORCE_FILESYSTEM=1'
  cmake --build build -j4
  ;;
 quake)
  cd "$ROOT/quake/WinQuake"
  mkdir -p id1
  printf '%s\n' 'Local game files are supplied at runtime.' > id1/README.txt
  emmake make -f Makefile.emscripten -j4 'LDFLAGS=-O3 -sUSE_SDL=2 -sINITIAL_MEMORY=64MB -sSTACK_SIZE=2MB -sALLOW_MEMORY_GROWTH -sEXPORTED_RUNTIME_METHODS=FS,IDBFS,callMain -sFORCE_FILESYSTEM=1 --preload-file=id1 --shell-file shell.html -lidbfs.js'
  ;;
 tyrian)
  cd "$ROOT/tyrian"
  objects=(); for source_file in src/*.c; do objects+=("obj/$(basename "${source_file%.c}").o"); done
  emmake make -j4 CC=emcc "${objects[@]}"
  emcc -flto -O3 obj/*.o -o index.js -sUSE_SDL=2 -sASYNCIFY -sENVIRONMENT=web -sSTACK_SIZE=262144 -sALLOW_MEMORY_GROWTH -sEXPORTED_RUNTIME_METHODS=FS,IDBFS,addRunDependency,removeRunDependency -lidbfs.js
  ;;
 cadet)
  mkdir -p "$ROOT/cadet-runtime"
  cp "$ROOT/cadet/PINBALL.DAT" "$ROOT/cadet/"*.wav "$ROOT/cadet-runtime/"
  cd "$ROOT/pinball-web"
  emcmake cmake -S . -B build -DCMAKE_BUILD_TYPE=Release
  cmake --build build -j4
  ;;
 scummvm)
  cd "$ROOT/scummvm"
  emconfigure ./configure --host=wasm32-unknown-emscripten --build=wasm32-unknown-emscripten --disable-all-engines --enable-engine=sky,lure,queen,cge --disable-cloud --disable-libcurl --disable-mad --disable-flac --disable-fluidsynth --disable-mt32emu --disable-opengl-game
  emmake make -j4
  ;;
 openttd)
  source "$ROOT/emsdk6/emsdk_env.sh"
  cd "$ROOT/openttd"
  cp os/emscripten/ports/liblzma.py "$ROOT/emsdk6/upstream/emscripten/tools/ports/contrib/liblzma.py"
  cmake -S . -B build-host -DOPTION_TOOLS_ONLY=ON
  cmake --build build-host -j4
  emcmake cmake -S . -B build -DHOST_BINARY_DIR="$ROOT/openttd/build-host" -DCMAKE_BUILD_TYPE=Release -DOPTION_USE_ASSERTS=OFF
  cmake --build build --target openttd -j4
  ;;
 *) echo 'Usage: bash scripts/build-engines.sh doom|quake|tyrian|cadet|scummvm|openttd' >&2; exit 1;;
esac
