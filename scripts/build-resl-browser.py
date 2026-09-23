#!/usr/bin/env python3
"""Build a private reSL WebAssembly candidate with generated art assets.

The result is not release-ready until the full source audit and gameplay gate pass.
Run under an activated Emscripten 6.0.1 environment:
  python3 build-resl-browser.py CHECKOUT OUTPUT GENERATED_ASSETS GENERATED_GLYPHS GENERATED_SCENARIO
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
UNREPLACED_VISUAL_TABLES: tuple[str, ...] = ()
REPLACEMENT_GLYPHS = {
    "dispatcher_glyph.cpp", "impasse_glyph.cpp",
    "static_object_glyph.cpp", "train_finished_exclamation_glyph.cpp",
    "small_font.cpp", "text_glyphs.cpp",
    "semaphore_glyph.cpp",
    "glyph_empty_background.cpp",
    "rail_glyph.cpp",
    "train_glyph.cpp",
}
if len(sys.argv) != 6:
    raise SystemExit("Usage: build-resl-browser.py CHECKOUT OUTPUT GENERATED_ASSETS GENERATED_GLYPHS GENERATED_SCENARIO")

checkout, output, generated, generated_glyphs, generated_scenario = (Path(value).resolve() for value in sys.argv[1:])
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

glyph_manifest = json.loads((generated_glyphs / "manifest.json").read_text())
if glyph_manifest.get("license") != "CC0-1.0" or glyph_manifest.get("originalAssetsRead") is not False:
    raise SystemExit("Independent glyph provenance check failed")
if {item["name"] for item in glyph_manifest["files"]} != REPLACEMENT_GLYPHS:
    raise SystemExit("Unexpected generated glyph inventory")
for item in glyph_manifest["files"]:
    data = (generated_glyphs / item["name"]).read_bytes()
    if len(data) != item["bytes"] or hashlib.sha256(data).hexdigest() != item["sha256"]:
        raise SystemExit(f"Generated glyph checksum mismatch: {item['name']}")
cursor_record = glyph_manifest["cursor"]
cursor_data = (generated_glyphs / cursor_record["name"]).read_bytes()
if (cursor_record["name"] != "cursor.json"
        or len(cursor_data) != cursor_record["bytes"]
        or hashlib.sha256(cursor_data).hexdigest() != cursor_record["sha256"]):
    raise SystemExit("Generated cursor checksum mismatch")
cursor = json.loads(cursor_data)
if set(cursor) != {"black", "white"} or any(
    len(cursor[layer]) != 32 or any(not isinstance(value, int) or not 0 <= value <= 255 for value in cursor[layer])
    for layer in ("black", "white")
):
    raise SystemExit("Invalid generated cursor dimensions")

scenario_manifest = json.loads((generated_scenario / "manifest.json").read_text())
expected_scenario = {
    "allowed_cursor_rail_types.cpp", "entrance_rails.cpp",
    "chunk_bounding_boxes.cpp", "train_specification.cpp",
}
if scenario_manifest.get("license") != "CC0-1.0" or scenario_manifest.get("originalAssetsRead") is not False:
    raise SystemExit("Independent scenario provenance check failed")
if {item["name"] for item in scenario_manifest["files"]} != expected_scenario:
    raise SystemExit("Unexpected generated scenario inventory")
for item in scenario_manifest["files"]:
    data = (generated_scenario / item["name"]).read_bytes()
    if len(data) != item["bytes"] or hashlib.sha256(data).hexdigest() != item["sha256"]:
        raise SystemExit(f"Generated scenario checksum mismatch: {item['name']}")

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
for item in glyph_manifest["files"]:
    shutil.copyfile(generated_glyphs / item["name"], source / "src/game/resources" / item["name"])
for item in scenario_manifest["files"]:
    shutil.copyfile(generated_scenario / item["name"], source / "src/game/resources" / item["name"])

mouse = source / "src/system/driver/sdl/mouse.cpp"
mouse_text = mouse.read_text()
for number, layer in ((1, "black"), (2, "white")):
    pattern = rf"const std::uint8_t g_cursorGlyph{number}\[\] = \{{.*?\}};"
    new_array = (
        f"const std::uint8_t g_cursorGlyph{number}[] = {{\n        "
        + ", ".join(f"0x{value:02X}" for value in cursor[layer])
        + "\n    };"
    )
    mouse_text, count = re.subn(pattern, new_array, mouse_text, count=1, flags=re.S)
    if count != 1:
        raise SystemExit(f"Pinned SDL cursor table {number} changed")
mouse.write_text(mouse_text)

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

# The upstream game defaults its melody flag to on and waits several frames
# when a menu key is rejected. Disable that behavior as well as SDL output.
melody = source / "src/game/melody.cpp"
melody_text = melody.read_text()
sound_flag = "bool g_soundEnabled = true;"
if melody_text.count(sound_flag) != 1:
    raise SystemExit("Pinned melody default changed")
melody.write_text(melody_text.replace(sound_flag, "bool g_soundEnabled = false;"))

build = output / "build"
build.mkdir(parents=True)
subprocess.run(["emcmake", "cmake", "-DCMAKE_BUILD_TYPE=Release", str(source)], cwd=build, check=True)
subprocess.run(["cmake", "--build", ".", "-j4"], cwd=build, check=True)

files = []
for name in ("resl.js", "resl.wasm"):
    data = (build / name).read_bytes()
    files.append({"path": name, "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()})
for relative in ("CMakeLists.txt", "src/system/driver/sdl/driver.cpp", "src/system/driver/sdl/audio.cpp", "src/system/driver/sdl/mouse.cpp", "src/game/melody.cpp"):
    data = (source / relative).read_bytes()
    files.append({"path": f"replacement-source/{relative}", "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()})

# The build stays private while the source-data audit and gameplay gate remain
# open. Retain an explicit inventory should an uncovered table be found later.
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
    "replacementGlyphs": glyph_manifest["files"],
    "replacementCursor": cursor_record,
    "replacementScenario": scenario_manifest["files"],
    "originalExternalResourcesBundled": False,
    "listedEmbeddedGlyphTablesReplaced": True,
    "embeddedVisualsReplaced": False,
    "unreplacedEmbeddedVisuals": embedded_visuals,
    "audioBackend": "null",
    "classicModuleForSharedPlayer": True,
    "saveRoot": "/persistent",
    "browserTested": False,
    "releaseReady": False,
    "blockers": [
        "Inspect generated artwork and alignment in a private muted browser build",
        "Audit remaining non-glyph source files and gameplay tables separately from presentation data",
        "Test the independent campaign's entrance placement and train roster for a completable loop",
        "Confirm menu, rail and train legibility and placement through muted gameplay tests",
        "Complete a gameplay loop and persistence round trip before release",
    ],
}
(output / "build-record.json").write_text(json.dumps(record, indent=2) + "\n")
print(json.dumps(record, indent=2))
