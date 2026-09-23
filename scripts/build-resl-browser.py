#!/usr/bin/env python3
"""Build a private reSL WebAssembly candidate with generated external assets.

The result is not release-ready until the embedded visual tables are replaced.
Run under an activated Emscripten 6.0.1 environment:
  python3 build-resl-browser.py CHECKOUT OUTPUT GENERATED_ASSETS
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
import re
import shutil
import subprocess
import sys

REVISION = "470cca330ee9abcf6173c843f4c89686c0c7e525"
UNREPLACED_VISUAL_TABLES = (
    "dispatcher_glyph.cpp",
    "glyph_empty_background.cpp",
    "impasse_glyph.cpp",
    "rail_glyph.cpp",
    "semaphore_glyph.cpp",
    "small_font.cpp",
    "static_object_glyph.cpp",
    "text_glyphs.cpp",
    "train_finished_exclamation_glyph.cpp",
    "train_glyph.cpp",
)
if len(sys.argv) != 4:
    raise SystemExit("Usage: build-resl-browser.py CHECKOUT OUTPUT GENERATED_ASSETS")

checkout, output, generated = (Path(value).resolve() for value in sys.argv[1:])
revision = subprocess.check_output(["git", "-C", str(checkout), "rev-parse", "HEAD"], text=True).strip()
if revision != REVISION:
    raise SystemExit("Unexpected reSL source revision")
subprocess.run(["git", "-C", str(checkout), "diff", "--exit-code", "HEAD"], check=True)
toolchain = subprocess.check_output(["emcc", "--version"], text=True).splitlines()[0]
if "6.0.1" not in toolchain:
    raise SystemExit("This exploratory recipe requires Emscripten 6.0.1")
if output.exists():
    raise SystemExit("Choose a new output directory")

asset_manifest = json.loads((generated / "manifest.json").read_text())
if asset_manifest.get("license") != "CC0-1.0" or asset_manifest.get("originalAssetsRead") is not False:
    raise SystemExit("Independent asset provenance check failed")
expected_assets = {
    "play.7", "poster.7", "captions.7", "GAMEOVER.7", "RULES.TXT",
    "build_rail_icon.png", "call_server_icon.png", "time_fast2.png", "time_fast3.png",
}
if {item["name"] for item in asset_manifest["files"]} != expected_assets:
    raise SystemExit("Unexpected generated asset inventory")
for item in asset_manifest["files"]:
    data = (generated / item["name"]).read_bytes()
    if len(data) != item["bytes"] or hashlib.sha256(data).hexdigest() != item["sha256"]:
        raise SystemExit(f"Generated asset checksum mismatch: {item['name']}")

source = output / "replacement-source"
def ignore_original_resources(directory: str, names: list[str]) -> set[str]:
    # Ignore only the repository's top-level original-data directory. The
    # source tree also has src/game/resources, which contains required C++.
    if Path(directory).resolve() == checkout:
        return {name for name in (".git", "resources", "build") if name in names}
    return set()

shutil.copytree(checkout, source, ignore=ignore_original_resources)
asset_dir = source / "resources" / "open-junction"
asset_dir.mkdir(parents=True)
for item in asset_manifest["files"]:
    shutil.copyfile(generated / item["name"], asset_dir / item["name"])

cmake = source / "CMakeLists.txt"
cmake_text = cmake.read_text()
resource_list = "set(resources\n" + "".join(
    f"    resources/open-junction/{name}\n" for name in sorted(expected_assets)
) + ")"
cmake_text, count = re.subn(r"set\(resources\n.*?\n\)", resource_list, cmake_text, count=1, flags=re.S)
if count != 1:
    raise SystemExit("Pinned CMake resource list changed")
for snippet in (
    "    file (GLOB reSL LIST_DIRECTORIES false ${CMAKE_CURRENT_SOURCE_DIR}/resources/reSL/*)\n",
    "    file (GLOB extra LIST_DIRECTORIES false ${CMAKE_CURRENT_SOURCE_DIR}/resources/extra/*)\n",
    "    list (APPEND resources ${reSL} ${extra})\n",
):
    if cmake_text.count(snippet) != 1:
        raise SystemExit("Pinned CMake resource glob changed")
    cmake_text = cmake_text.replace(snippet, "")
for option in (
    '        "-sINVOKE_RUN=0"\n',
    '        "-sMODULARIZE=1"\n',
    '        "-sEXPORT_NAME=\\"createModule\\""\n',
):
    if cmake_text.count(option) != 1:
        raise SystemExit(f"Pinned Emscripten option changed: {option.strip()}")
    cmake_text = cmake_text.replace(option, "")
runtime_methods = '        "-sEXPORTED_RUNTIME_METHODS=[\\"callMain\\",\\"addOnExit\\",\\"JSEvents\\"]"\n'
replacement_methods = '        "-sEXPORTED_RUNTIME_METHODS=[\\"FS\\",\\"IDBFS\\",\\"addRunDependency\\",\\"removeRunDependency\\",\\"JSEvents\\"]"\n'
if cmake_text.count(runtime_methods) != 1:
    raise SystemExit("Pinned exported runtime methods changed")
cmake.write_text(cmake_text.replace(runtime_methods, replacement_methods))

driver = source / "src/system/driver/sdl/driver.cpp"
driver_text = driver.read_text()
audio_flag = "SDL_Init(SDL_INIT_VIDEO | SDL_INIT_AUDIO | SDL_INIT_EVENTS)"
if driver_text.count(audio_flag) != 1:
    raise SystemExit("Pinned SDL initialization changed")
driver.write_text(driver_text.replace(audio_flag, "SDL_Init(SDL_INIT_VIDEO | SDL_INIT_EVENTS)"))

audio = source / "src/system/driver/sdl/audio.cpp"
audio.write_text('''#include "audio.h"\n\nnamespace resl {\nAudioDriver::AudioDriver() = default;\nAudioDriver::~AudioDriver() = default;\nvoid AudioDriver::startSound(std::uint16_t) {}\nvoid AudioDriver::stopSound() {}\nvoid AudioDriver::fillBuffer(void*, Uint8*, int) {}\nvoid AudioDriver::fill(float* buffer, int length) {\n    for (int i = 0; i < length; ++i) buffer[i] = 0.0f;\n}\n} // namespace resl\n''')

build = output / "build"
build.mkdir(parents=True)
subprocess.run(["emcmake", "cmake", "-DCMAKE_BUILD_TYPE=Release", str(source)], cwd=build, check=True)
subprocess.run(["cmake", "--build", ".", "-j4"], cwd=build, check=True)

files = []
for name in ("resl.js", "resl.wasm"):
    data = (build / name).read_bytes()
    files.append({"path": name, "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()})
for relative in ("CMakeLists.txt", "src/system/driver/sdl/driver.cpp", "src/system/driver/sdl/audio.cpp"):
    data = (source / relative).read_bytes()
    files.append({"path": f"replacement-source/{relative}", "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()})

# The build is intentionally private while upstream-derived presentation is
# still compiled in. Record exact inputs so this cannot be mistaken for a
# replacement-only release merely because the external resource folder is new.
embedded_visuals = []
for name in UNREPLACED_VISUAL_TABLES:
    relative = f"src/game/resources/{name}"
    data = (source / relative).read_bytes()
    embedded_visuals.append({
        "path": relative,
        "bytes": len(data),
        "sha256": hashlib.sha256(data).hexdigest(),
        "provenance": "upstream reconstruction; replacement pending",
    })

record = {
    "sourceRevision": REVISION,
    "toolchain": toolchain,
    "files": files,
    "replacementAssets": asset_manifest["files"],
    "originalExternalResourcesBundled": False,
    "embeddedVisualsReplaced": False,
    "unreplacedEmbeddedVisuals": embedded_visuals,
    "audioBackend": "null",
    "classicModuleForSharedPlayer": True,
    "saveRoot": "/persistent",
    "browserTested": False,
    "releaseReady": False,
    "blockers": [
        "Replace or clear every copyrightable visual table compiled from src/game/resources",
        "Audit remaining gameplay tables separately from presentation data",
        "Complete muted gameplay-loop and persistence tests after the source-data audit",
    ],
}
(output / "build-record.json").write_text(json.dumps(record, indent=2) + "\n")
print(json.dumps(record, indent=2))
