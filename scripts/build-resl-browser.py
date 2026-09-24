#!/usr/bin/env python3
"""Build a private reSL WebAssembly candidate with generated art assets.

The result is not release-ready until the full source audit and gameplay gate pass.
Run under an activated Emscripten 6.0.1 environment:
  python3 build-resl-browser.py CHECKOUT OUTPUT GENERATED_ASSETS GENERATED_GLYPHS GENERATED_SCENARIO
"""
from __future__ import annotations

import hashlib
import json
import os
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
    "semaphore_glyph.cpp", "semaphore_glyph_bias.cpp",
    "glyph_empty_background.cpp",
    "rail_glyph.cpp",
    "train_glyph.cpp",
}
RETAINED_ENGINE_GEOMETRY_TABLES = {
    "movement_paths.cpp",
    "rail_connection_bias.cpp", "rail_connection_rule.cpp",
    "rail_type_meta.cpp",
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
palette = asset_manifest.get("paletteRGB")
if (not isinstance(palette, list) or len(palette) != 16 or any(
    not isinstance(rgb, list) or len(rgb) != 3 or any(
        not isinstance(channel, int) or not 0 <= channel <= 255 for channel in rgb
    ) for rgb in palette
)):
    raise SystemExit("Independent runtime palette is missing or invalid")
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
    "allowed_cursor_rail_types.cpp", "entrance_rails.cpp", "entrance.cpp",
    "chunk_bounding_boxes.cpp", "train_specification.cpp", "carriage_bias.cpp",
}
source_tables = {path.name for path in (checkout / "src/game/resources").glob("*.cpp")}
if source_tables != REPLACEMENT_GLYPHS | expected_scenario | RETAINED_ENGINE_GEOMETRY_TABLES:
    raise SystemExit(f"Unclassified pinned resource tables: {sorted(source_tables ^ (REPLACEMENT_GLYPHS | expected_scenario | RETAINED_ENGINE_GEOMETRY_TABLES))}")
if scenario_manifest.get("license") != "CC0-1.0" or scenario_manifest.get("originalAssetsRead") is not False:
    raise SystemExit("Independent scenario provenance check failed")
if {item["name"] for item in scenario_manifest["files"]} != expected_scenario:
    raise SystemExit("Unexpected generated scenario inventory")
for item in scenario_manifest["files"]:
    data = (generated_scenario / item["name"]).read_bytes()
    if len(data) != item["bytes"] or hashlib.sha256(data).hexdigest() != item["sha256"]:
        raise SystemExit(f"Generated scenario checksum mismatch: {item['name']}")
entrance_choices = scenario_manifest.get("initialEntranceIndices")
if (not isinstance(entrance_choices, list) or len(entrance_choices) != 6
        or len(set(entrance_choices)) != 6 or any(
            not isinstance(value, int) or not 0 <= value < 46
            or ((value < 23) != (slot % 2 == 0))
            for slot, value in enumerate(entrance_choices)
        )):
    raise SystemExit("Independent entrance schedule is invalid")
starter_route = scenario_manifest.get("starterRoute")
if (not isinstance(starter_route, list) or len(starter_route) != 3
        or any(not isinstance(rail, dict) or set(rail) != {"x", "y", "type"}
               or any(not isinstance(rail[key], int) for key in ("x", "y", "type"))
               or not (1 <= rail["x"] <= 9 and 1 <= rail["y"] <= 9
                       and abs(rail["x"] - rail["y"]) <= 3
                       and 4 <= rail["x"] + rail["y"] <= 16
                       and 0 <= rail["type"] < 6)
               for rail in starter_route)
        or len({(rail["x"], rail["y"], rail["type"]) for rail in starter_route}) != 3):
    raise SystemExit("Independent starter route is invalid")

source = output / "replacement-source"
source.mkdir(parents=True)
# Keep only the browser build's corresponding source. The upstream repository
# also has original game files under resources/ and mobile launcher images;
# neither belongs in a replacement-only browser source archive.
for name in ("CMakeLists.txt", "LICENSE", "README.md"):
    shutil.copyfile(checkout / name, source / name)
def ignore_source_extraction_tools(directory: str, names: list[str]) -> set[str]:
    if Path(directory).resolve() == (checkout / "src/game/resources").resolve():
        return {name for name in ("scripts", "utility") if name in names}
    return set()

shutil.copytree(checkout / "src", source / "src", ignore=ignore_source_extraction_tools)
# Pin a source-wide presentation-data inventory in addition to the resource
# table allowlist above. These are the only non-resource byte-array definitions
# in this upstream revision: transient train state, the font spacing classes,
# two cursor bitplanes, and DOS keycode translation. The font and cursor are
# replaced below; the other two are engine state/input mappings, not art.
source_code = [path for path in (source / "src").rglob("*") if path.is_file()]
if any(path.suffix not in {".c", ".cpp", ".h"} for path in source_code):
    raise SystemExit("Unclassified non-code file in pinned source tree")
non_resource_byte_arrays = {
    (path.relative_to(source).as_posix(), name)
    for path in source_code
    if "resources" not in path.parts
    for name in re.findall(
        r"\b(?:std::)?uint8_t\s+(g_\w+)\s*\[[^\]]*\]\s*=",
        path.read_text(errors="replace"),
    )
}
expected_byte_arrays = {
    ("src/game/train.cpp", "g_lastProcessedCarriages"),
    ("src/graphics/text.cpp", "g_charTraits"),
    ("src/system/driver/sdl/mouse.cpp", "g_cursorGlyph1"),
    ("src/system/driver/sdl/mouse.cpp", "g_cursorGlyph2"),
    ("src/ui/components/dialog.cpp", "g_asciiToKeycodeTable"),
}
if non_resource_byte_arrays != expected_byte_arrays:
    raise SystemExit(f"Unclassified non-resource byte arrays: {sorted(non_resource_byte_arrays ^ expected_byte_arrays)}")
literal_file_reads = {
    (kind, name)
    for path in source_code
    for kind, name in re.findall(
        r'\bread(Binary|Text)File\("([^"]+)"\)', path.read_text(errors="replace")
    )
}
expected_literal_reads = {
    ("Binary", "play.7"), ("Binary", "poster.7"),
    ("Binary", "captions.7"), ("Binary", "GAMEOVER.7"),
    ("Text", "RULES.TXT"),
}
if literal_file_reads != expected_literal_reads:
    raise SystemExit(f"Unclassified literal file reads: {sorted(literal_file_reads ^ expected_literal_reads)}")
asset_dir = source / "resources" / "open-junction"
asset_dir.mkdir(parents=True)
for item in asset_manifest["files"]:
    shutil.copyfile(generated / item["name"], asset_dir / item["name"])
for item in glyph_manifest["files"]:
    shutil.copyfile(generated_glyphs / item["name"], source / "src/game/resources" / item["name"])
for item in scenario_manifest["files"]:
    shutil.copyfile(generated_scenario / item["name"], source / "src/game/resources" / item["name"])

# The inherited character-trait table encodes spacing for the original
# proportional font. Open Junction's independently drafted glyphs all declare
# their own widths, so measure the actual replacement font instead.
text_source = source / "src/graphics/text.cpp"
text_body = text_source.read_text()
traits_start = text_body.find("/* 1d7d:2969 : 256 bytes */")
traits_end = text_body.find("/* 1d7d:2962 : 2 bytes */", traits_start)
if traits_start < 0 or traits_end < 0 or text_body.count("g_charTraits[") != 2:
    raise SystemExit("Pinned original font-trait table changed")
text_body = text_body[:traits_start] + text_body[traits_end:]
measure_original = (
    "        width += g_textSpacing + 9;\n"
    "        if (g_charTraits[static_cast<std::size_t>(*s)] & (4 | 2))\n"
    "            width += 4;\n"
)
if text_body.count(measure_original) != 1:
    raise SystemExit("Pinned original font measurement changed")
text_body = text_body.replace(
    measure_original,
    "        const auto code = static_cast<std::uint8_t>(*s);\n"
    "        width += g_textSpacing + (code >= 32 && code < 179\n"
    "            ? g_textGlyphs[code - 32].width : 8);\n",
    1,
)
text_body = text_body.replace("#include <cstddef>\n", "#include <cstddef>\n#include <cstdint>\n", 1)
text_source.write_text(text_body)

init = source / "src/game/init.cpp"
init_text = init.read_text()
selection_pattern = r"        bool suits = false;\n        while \(!suits\) \{.*?\n        \}\n"
choice_cpp = ", ".join(str(value) for value in entrance_choices)
selection_cpp = (
    "        // Independent Open Junction station schedule.\n"
    f"        static constexpr std::uint8_t stationChoices[6] = {{{choice_cpp}}};\n"
    "        entrance.entranceRailInfoIdx = stationChoices[i];\n"
)
init_text, count = re.subn(selection_pattern, selection_cpp, init_text, count=1, flags=re.S)
if count != 1:
    raise SystemExit("Pinned entrance selection changed")
route_marker = "    generateEntrances();\n    generateForest();\n"
if init_text.count(route_marker) != 1:
    raise SystemExit("Pinned starter-route insertion changed")
route_cpp = "".join(
    f"        {{0, {rail['x']}, {rail['y']}, {rail['type']}, 0}},\n"
    for rail in starter_route
)
init_text = init_text.replace(
    route_marker,
    route_marker
    + "    // Independent Open Junction starter track between the first stations.\n"
    + "    static constexpr RailInfo starterRoute[] = {\n"
    + route_cpp
    + "    };\n"
    + "    for (const RailInfo& ri : starterRoute) {\n"
    + "        destroyStaticObjectsForRailConstruction(g_rails[ri.tileX][ri.tileY][ri.railType]);\n"
    + "        connectRail(ri);\n"
    + "        g_railRoad[g_railRoadCount++] = ri;\n"
    + "        updateSemaphores(ri);\n"
    + "    }\n",
    1,
)
forest_pattern = r"static void generateForest\(\)\n\{.*?\n\}\n\n/\* 16a6:0963 \*/"
forest_cpp = """static void generateForest()
{
    // Open Junction's sparse scenery layout is independent of ShortLine's
    // clustered random walk. Trees use the separately generated CC0 glyphs.
    constexpr std::size_t treeCount = 32;
    for (std::size_t i = 30; i < std::size(g_staticObjects); ++i)
        g_staticObjects[i].kind = StaticObjectKind::None;
    for (std::size_t tree = 0; tree < treeCount; ++tree) {
        StaticObject& obj = g_staticObjects[30 + tree];
        bool placed = false;
        for (int attempt = 0; attempt < 120 && !placed; ++attempt) {
            const std::int16_t x = 16 + genRandomNumber(608);
            const std::int16_t y = 64 + genRandomNumber(246);
            if (!isInsideField(x, y))
                continue;
            placed = true;
            for (std::size_t earlier = 30; earlier < 30 + tree; ++earlier) {
                const StaticObject& other = g_staticObjects[earlier];
                if (other.kind != StaticObjectKind::Tree)
                    continue;
                const int dx = x - other.x;
                const int dy = y - other.y;
                if (dx * dx + dy * dy < 36 * 36) {
                    placed = false;
                    break;
                }
            }
            if (placed) {
                obj.kind = StaticObjectKind::Tree;
                obj.type = static_cast<std::uint8_t>(genRandomNumber(4));
                obj.x = x;
                obj.y = y;
                obj.color = tree % 3 ? Color::DarkGreen : Color::Brown;
            }
        }
    }
    std::qsort(static_cast<void*>(g_staticObjects),
               std::size(g_staticObjects), sizeof(StaticObject),
               compareStaticObjByY);
}

/* 16a6:0963 */"""
init_text, count = re.subn(forest_pattern, forest_cpp, init_text, count=1, flags=re.S)
if count != 1:
    raise SystemExit("Pinned forest generator changed")
init.write_text(init_text)

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

video = source / "src/system/driver/sdl/video.cpp"
video_text = video.read_text()
original_window_title = '"reSL - reverse engineered ShortLine game"'
if video_text.count(original_window_title) != 1:
    raise SystemExit("Pinned window title changed")
video_text = video_text.replace(original_window_title, '"Open Junction - reSL engine"', 1)
clear_color = "SDL_SetRenderDrawColor(m_renderer, 0x55, 0xAA, 0x00, 0xFF);"
if video_text.count(clear_color) != 1:
    raise SystemExit("Pinned SDL board-clear color changed")
video_text = video_text.replace(
    clear_color,
    "SDL_SetRenderDrawColor(m_renderer, "
    + ", ".join(f"0x{value:02X}" for value in palette[0])
    + ", 0xFF);",
    1,
)
runtime_colors = [
    (0 if index == 0 else 255) << 24 | red << 16 | green << 8 | blue
    for index, (red, green, blue) in enumerate(palette)
]
palette_cpp = "m_vgaState.palette = {\n" + "".join(
    f"        0x{value:08X}{',' if index < 15 else ''}\n"
    for index, value in enumerate(runtime_colors)
) + "    };"
video_text, count = re.subn(
    r"m_vgaState\.palette = \{\n.*?\n    \};", palette_cpp,
    video_text, count=1, flags=re.S,
)
if count != 1:
    raise SystemExit("Pinned runtime palette changed")
video.write_text(video_text)

status_bar = source / "src/ui/components/status_bar.cpp"
status_text = status_bar.read_text()
original_footer = '" * SHORTLINE * Game by Andrei Snegov * (c) DOKA 1992 Moscow * Version 1.1 *"'
if status_text.count(original_footer) != 1:
    raise SystemExit("Pinned footer credit changed")
status_bar.write_text(status_text.replace(
    original_footer,
    '"OPEN JUNCTION - RESL ENGINE - CC0 ART - SOURCE AT DECOMPGAMES.COM"',
    1,
))

# The original grass routine scatters over a thousand random black pixels
# across the board. The independent map uses a clear drafted grid instead.
static_objects = source / "src/game/static_object.cpp"
static_text = static_objects.read_text()
grass_call = "    drawGrass(yOffset);\n"
if static_text.count(grass_call) != 1:
    raise SystemExit("Pinned grass draw call changed")
static_objects.write_text(static_text.replace(grass_call, "", 1))

# The pinned engine rebuilds its offscreen world after entrances appear. Its
# original flat-color field fill erases the independent grid from play.7, so
# restore that replacement board before drawing tracks and scenery over it.
world = source / "src/game/drawing.cpp"
world_text = world.read_text()
flat_field = """void fillGameFieldBackground(std::int16_t yOffset)
{
    graphics::filledRectangle(0, 49 + yOffset, 80, 285, 0xFF, Color::Green);
}
"""
if world_text.count(flat_field) != 1:
    raise SystemExit("Pinned world background fill changed")
grid_field = """void fillGameFieldBackground(std::int16_t yOffset)
{
    std::span<const std::byte> data = readBinaryFile("play.7");
    if (data.empty()) [[unlikely]] {
        std::cerr << "unable to read replacement board 'play.7'" << std::endl;
        graphics::filledRectangle(0, 49 + yOffset, 80, 285, 0xFF, Color::Green);
    } else {
        graphics::imageDot7(0, yOffset, LOGICAL_SCREEN_WIDTH, LOGICAL_SCREEN_HEIGHT,
                            reinterpret_cast<const std::uint8_t*>(data.data()));
    }
}
"""
world.write_text(world_text.replace(flat_field, grid_field, 1))

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

# The shared player mounts and restores the namespaced save volume before
# starting the engine. Keep the standalone private smoke's upstream mount,
# but do not mount a second IDBFS over an already restored player volume.
filesystem = source / "src/system/filesystem.cpp"
filesystem_text = filesystem.read_text()
mount_marker = """        FS.mkdir(path);
        FS.mount(IDBFS, {
            autoPersist: true
        }, path);
        FS.syncfs(true, (err) => {
            console.error(`FS.syncfs failed: ${err}`);
        });"""
if filesystem_text.count(mount_marker) != 1:
    raise SystemExit("Pinned filesystem mount marker changed")
filesystem.write_text(filesystem_text.replace(mount_marker, """        if (!FS.analyzePath(path).exists) FS.mkdir(path);
        var alreadyMounted = FS.getMounts(FS.root.mount)
            .some((mount) => mount.mountpoint === path);
        if (!alreadyMounted) {
            FS.mount(IDBFS, { autoPersist: true }, path);
            FS.syncfs(true, (err) => {
                console.error(`FS.syncfs failed: ${err}`);
            });
        }"""))

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

# The original idle menu launches a prerecorded demo save. Those saves are
# deliberately excluded; keep the menu waiting for user input instead of
# repeatedly probing the missing original-data path.
dialog = source / "src/ui/components/dialog.cpp"
dialog_text = dialog.read_text()
timeout_branch = "if (timeout-- == 0)\n                    return -1;"
if dialog_text.count(timeout_branch) != 1:
    raise SystemExit("Pinned dialog timeout changed")
dialog.write_text(dialog_text.replace(
    timeout_branch,
    "if (type != DialogType::MainMenu && timeout-- == 0)\n"
    "                    return -1;",
))
if os.environ.get("OPEN_JUNCTION_TRACE") == "1":
    dialog_text = dialog.read_text()
    dialog_text = dialog_text.replace("#include <optional>\n", "#include <optional>\n#include <iostream>\n", 1)
    marker = "    const Dialog& dlg = g_dialogs[static_cast<int>(type)];"
    if dialog_text.count(marker) != 1:
        raise SystemExit("Pinned dialog entry changed")
    dialog_text = dialog_text.replace(marker, "    static int ojTraceFrame = 0;\n" + marker, 1)
    wait_line = "                vga::waitVerticalRetrace();"
    if dialog_text.count(wait_line) != 1:
        raise SystemExit("Pinned dialog wait loop changed")
    dialog_text = dialog_text.replace(
        wait_line,
        "                if (type == DialogType::MainMenu && (++ojTraceFrame % 120) == 0)\n"
        '                    std::cerr << "OJ menu frame " << ojTraceFrame << std::endl;\n'
        + wait_line,
        1,
    )
    dialog.write_text(dialog_text)

menu = source / "src/ui/main_menu.cpp"
menu_text = menu.read_text()
demo_start = menu_text.find("        case -1:\n", menu_text.find("void mainMenu()"))
demo_end = menu_text.find("        case 2:\n", demo_start)
if demo_start < 0 or demo_end < 0 or menu_text[demo_start:demo_end].count("loadDemo()") != 1:
    raise SystemExit("Pinned main-menu demo branch changed")
menu.write_text(
    menu_text[:demo_start]
    + '        case -1:\n            break;\n\n'
      '        case 1:\n            alert("Demo unavailable");\n            break;\n\n'
    + menu_text[demo_end:]
)

# A browser player already has its own loading progress. Keep this engine's
# independent title card brief so visitors do not wait through the original
# roughly 24-second rotating-caption sequence before reaching the menu.
loading = source / "src/ui/loading_screen.cpp"
loading_text = loading.read_text()
for old, new in (
    ("constexpr std::int16_t nItems = 5;", "constexpr std::int16_t nItems = 1;"),
    ("constexpr std::int16_t totalAnimationTime = 120;", "constexpr std::int16_t totalAnimationTime = 0;"),
    ("for (std::int16_t j = 0; j < 220; ++j)", "for (std::int16_t j = 0; j < 30; ++j)"),
):
    if loading_text.count(old) != 1:
        raise SystemExit(f"Pinned loading animation changed: {old}")
    loading_text = loading_text.replace(old, new)
loading.write_text(loading_text)
# The independent board has one shared line and no passing siding, even after
# the third station branches from it. Queue later services until the current
# train clears; otherwise trains with conflicting switch needs occupy the same
# short junction and the player cannot safely route either one. Keep this rule
# in both private and distributable builds so the tested gameplay is identical.
trains = source / "src/game/train.cpp"
train_text = trains.read_text()
waiting_marker = "void tryRunWaitingTrains()\n{\n"
new_train_marker = "    if (entranceIsFree(entranceIdx)) {\n"
if train_text.count(waiting_marker) != 1 or train_text.count(new_train_marker) != 1:
    raise SystemExit("Pinned starter-route dispatch markers changed")
train_text = train_text.replace(
    waiting_marker,
    waiting_marker + "    if (!noTrainsExist())\n"
    "        return;\n",
    1,
).replace(
    new_train_marker,
    "    if (!noTrainsExist()) {\n"
    "        addWaitingTrain(entranceIdx);\n"
    "        return;\n"
    "    }\n\n" + new_train_marker,
    1,
)
waiting_spawn_marker = "            if (train && !(--g_entrances[i].waitingTrainsCount))\n                drawDispatcher(i, false);\n"
if train_text.count(waiting_spawn_marker) != 1:
    raise SystemExit("Pinned waiting-service serialization marker changed")
train_text = train_text.replace(
    waiting_spawn_marker,
    waiting_spawn_marker + "            if (train) return;\n",
    1,
)
trains.write_text(train_text)
if os.environ.get("OPEN_JUNCTION_TRACE") == "1":
    loop = source / "src/game/main_loop.cpp"
    loop_text = loop.read_text()
    year_marker = "static std::int16_t g_gameTime = 0;\n"
    if loop_text.count(year_marker) != 1:
        raise SystemExit("Pinned game-time marker changed")
    loop_text = loop_text.replace(
        "#include <cstdlib>\n", "#include <cstdlib>\n#include <emscripten/emscripten.h>\n", 1,
    ).replace(
        '#include "rail.h"\n', '#include "rail.h"\n#include "switch.h"\n', 1,
    ).replace(
        year_marker,
        year_marker
        + '\n// Private branch test only; this hook is absent from distributable builds.\n'
        + 'extern "C" EMSCRIPTEN_KEEPALIVE int oj_trace_branch_switch_state() {\n'
        + '    const Rail* branch = &g_rails[4][1][2];\n'
        + '    for (int i = 0; i < g_nSwitches; ++i) {\n'
        + '        const Switch& sw = g_switches[i];\n'
        + '        if (sw.entry.rail == branch || sw.disabledPath.rail == branch)\n'
        + '            return ((sw.entry.rail == branch) ? 1 : 0) << 24\n'
        + '                | (sw.x & 4095) << 12 | (sw.y & 4095);\n'
        + '    }\n'
        + '    return -1;\n'
        + '}\n'
        + 'extern "C" EMSCRIPTEN_KEEPALIVE int oj_trace_mouse_state() {\n'
        + '    const auto& cursor = mouse::g_railCursorState;\n'
        + '    return ((mouse::g_state.mode == &mouse::g_modeConstruction) ? 1 : 0) << 24\n'
        + '        | (cursor.tileX & 255) << 16 | (cursor.tileY & 255) << 8\n'
        + '        | (cursor.railType & 255);\n'
        + '}\n'
        + 'extern "C" EMSCRIPTEN_KEEPALIVE void oj_trace_jump_to_1840() {\n'
        + '    g_headers[static_cast<int>(HeaderFieldId::Year)].value = 1840;\n'
        + '    g_gameTime = 1900;\n'
        + '    std::fprintf(stderr, "OJ year-1840 branch prepared\\n");\n'
        + '}\n'
        + 'static bool g_ojTraceForceTransition = false;\n'
        + 'extern "C" EMSCRIPTEN_KEEPALIVE void oj_trace_jump_to_2000() {\n'
        + '    g_ojTraceForceTransition = true;\n'
        + '    g_gameTime = 1900;\n'
        + '    std::fprintf(stderr, "OJ year-2000 branch prepared\\n");\n'
        + '}\n',
        1,
    )
    insolvency_hook = 'extern "C" EMSCRIPTEN_KEEPALIVE void oj_trace_insolvent() {\n'
    if insolvency_hook in loop_text:
        raise SystemExit("Private insolvency hook already exists")
    loop_text = loop_text.replace(
        'extern "C" EMSCRIPTEN_KEEPALIVE void oj_trace_jump_to_2000() {\n',
        insolvency_hook
        + '    g_headers[static_cast<int>(HeaderFieldId::Money)].value = 0;\n'
        + '    spendMoney(1);\n'
        + '    std::fprintf(stderr, "OJ game-over branch prepared\\n");\n'
        + '}\n\n'
        + 'extern "C" EMSCRIPTEN_KEEPALIVE void oj_trace_jump_to_2000() {\n',
        1,
    )
    transition_marker = "                case 2000:\n"
    if loop_text.count(transition_marker) != 1:
        raise SystemExit("Pinned level-transition marker changed")
    transition_switch = "                switch (g_headers[static_cast<int>(HeaderFieldId::Year)].value) {\n"
    if loop_text.count(transition_switch) != 1:
        raise SystemExit("Pinned level-switch marker changed")
    loop_text = loop_text.replace(
        transition_switch,
        '                if (g_ojTraceForceTransition) {\n'
        '                    g_headers[static_cast<int>(HeaderFieldId::Year)].value = 2000;\n'
        '                    g_ojTraceForceTransition = false;\n'
        '                }\n' + transition_switch,
        1,
    )
    loop_text = loop_text.replace(
        transition_marker,
        transition_marker + '                    std::fprintf(stderr, "OJ level transition entered\\n");\n',
        1,
    )
    alert_marker = '                    alert("Happy New 2000 Year!");\n'
    if loop_text.count(alert_marker) != 1:
        raise SystemExit("Pinned level-transition alert changed")
    loop_text = loop_text.replace(
        alert_marker,
        '                    std::fprintf(stderr, "OJ level transition alert\\n");\n'
        + alert_marker,
        1,
    )
    completed_marker = "                    g_headers[static_cast<int>(HeaderFieldId::Level)].value++;\n"
    if loop_text.count(completed_marker) != 1:
        raise SystemExit("Pinned level-increment marker changed")
    loop_text = loop_text.replace(
        completed_marker,
        completed_marker + '                    std::fprintf(stderr, "OJ level transition completed level %d year %d\\n", '
        + 'g_headers[static_cast<int>(HeaderFieldId::Level)].value, '
        + 'g_headers[static_cast<int>(HeaderFieldId::Year)].value);\n',
        1,
    )
    task_start = loop_text.find("Task taskGameMainLoop()")
    task_end = loop_text.find("        mainMenu();\n", task_start)
    if task_start < 0 or task_end < 0:
        raise SystemExit("Pinned startup scope changed")
    task_end += len("        mainMenu();\n")
    startup = loop_text[task_start:task_end]
    loading_if = "    if (g_isDemoMode || !g_gameOver)\n"
    if startup.count(loading_if) != 1:
        raise SystemExit("Pinned loading-screen condition changed")
    startup = startup.replace(
        loading_if,
        '    std::fprintf(stderr, "OJ stage: before loading\\n");\n' + loading_if,
        1,
    )
    stages = (
        ("        showLoadingScreen();\n", "after loading"),
        ("        createNewWorld();\n", "after create world"),
        ("        drawMainMenuBackground(350);\n", "after menu background"),
        ("        drawDialog(DialogType::MainMenu, 350);\n", "after menu dialog"),
        ("        graphics::animateScreenShifting();\n", "after screen shift"),
        ("        mainMenu();\n", "after main menu"),
    )
    for marker, message in stages:
        if startup.count(marker) != 1:
            raise SystemExit(f"Pinned main-loop trace marker changed: {message}")
        startup = startup.replace(
            marker,
            marker + f'    std::fprintf(stderr, "OJ stage: {message}\\n");\n',
            1,
        )
    loop.write_text(loop_text[:task_start] + startup + loop_text[task_end:])
    loop_text = loop.read_text()
    game_start = loop_text.find("        mainMenu();\n", task_start)
    game_end = loop_text.find("            bool needRestartGame = false;\n", game_start)
    if game_start < 0 or game_end < 0:
        raise SystemExit("Pinned gameplay-stage scope changed")
    game_segment = loop_text[game_start:game_end]
    for marker, message in (
        ("        menuButton.enable();\n", "menu enabled"),
        ("            resetTasks();\n", "tasks reset"),
        ("            mouse::g_state.mode->drawFn();\n", "mode drawn"),
        ("            enableTimer();\n", "timer enabled"),
    ):
        if game_segment.count(marker) != 1:
            raise SystemExit(f"Pinned gameplay stage changed: {message}")
        game_segment = game_segment.replace(
            marker,
            marker + f'            std::fprintf(stderr, "OJ stage: {message}\\n");\n',
            1,
        )
    loop_text = loop_text[:game_start] + game_segment + loop_text[game_end:]
    tick_marker = "                co_await sleep(50);\n"
    if loop_text.count(tick_marker) != 1:
        raise SystemExit("Pinned gameplay tick marker changed")
    loop.write_text(loop_text.replace(
        tick_marker,
        tick_marker
        + '                static int ojGameTicks = 0;\n'
        + '                if (++ojGameTicks == 1 || (ojGameTicks % 10) == 0) {\n'
        + '                    int ojActiveTrains = 0;\n'
        + '                    const Train* ojFirstTrain = nullptr;\n'
        + '                    for (const Train& train : g_trains) {\n'
        + '                        if (!train.isFreeSlot) {\n'
        + '                            ++ojActiveTrains;\n'
        + '                            if (!ojFirstTrain) ojFirstTrain = &train;\n'
        + '                        }\n'
        + '                    }\n'
        + '                    std::fprintf(stderr, "OJ game tick %d rails %u year %d entrances %d trains %d head %d,%d:%d\\n",\n'
        + '                        ojGameTicks, g_railRoadCount,\n'
        + '                        g_headers[static_cast<int>(HeaderFieldId::Year)].value,\n'
        + '                        g_entranceCount, ojActiveTrains,\n'
        + '                        ojFirstTrain && ojFirstTrain->head.rail ? ojFirstTrain->head.rail->x : -1,\n'
        + '                        ojFirstTrain && ojFirstTrain->head.rail ? ojFirstTrain->head.rail->y : -1,\n'
        + '                        ojFirstTrain ? ojFirstTrain->head.pathStep : -1);\n'
        + '                    for (int i = 0; i < static_cast<int>(g_trains.size()); ++i) {\n'
        + '                        const Train& train = g_trains[i];\n'
        + '                        if (train.isFreeSlot) continue;\n'
        + '                        std::fprintf(stderr, "OJ active train slot %d dst %d head %d,%d:%d\\n",\n'
        + '                            i, train.carriages[0].dstEntranceIdx,\n'
        + '                            train.head.rail ? train.head.rail->x : -1,\n'
        + '                            train.head.rail ? train.head.rail->y : -1,\n'
        + '                            train.head.pathStep);\n'
        + '                    }\n'
        + '                }\n',
        1,
    ))
    game_over = source / "src/ui/game_over.cpp"
    game_over_text = game_over.read_text()
    game_over_marker = "    g_gameOver = true;\n"
    if game_over_text.count(game_over_marker) != 1:
        raise SystemExit("Pinned game-over marker changed")
    game_over.write_text(game_over_text.replace(
        game_over_marker,
        '    std::cerr << "OJ game over entered" << std::endl;\n' + game_over_marker,
        1,
    ))
    mouse_game = source / "src/game/mouse/mouse.cpp"
    mouse_game_text = mouse_game.read_text()
    build_action = "        case MouseAction::BuildRails:\n"
    queue_action = "                        g_railConstructionMsgQueue.push(rcs);\n"
    if mouse_game_text.count(build_action) != 1 or mouse_game_text.count(queue_action) != 1:
        raise SystemExit("Pinned rail-build trace markers changed")
    mouse_game_text = mouse_game_text.replace(
        "#include <cstdint>\n", "#include <cstdint>\n#include <cstdio>\n", 1
    ).replace(
        build_action,
        build_action + '            std::fprintf(stderr, "OJ build click tile %d,%d type %d\\n", '
        'mouse::g_railCursorState.tileX, mouse::g_railCursorState.tileY, '
        'mouse::g_railCursorState.railType);\n',
        1,
    ).replace(
        queue_action,
        queue_action + '                        std::fprintf(stderr, "OJ build queued tile %d,%d type %d\\n", '
        'rcs.tileX, rcs.tileY, rcs.railType);\n',
        1,
    )
    mouse_game.write_text(mouse_game_text)
    construction = source / "src/game/road_construction.cpp"
    construction_text = construction.read_text()
    rail_commit = "        g_railRoad[g_railRoadCount++] = ri;\n"
    if construction_text.count(rail_commit) != 1:
        raise SystemExit("Pinned rail-construction completion marker changed")
    construction.write_text(construction_text.replace(
        rail_commit,
        rail_commit + '        std::fprintf(stderr, "OJ rail committed count %u\\n", g_railRoadCount);\n',
        1,
    ))
    trains = source / "src/game/train.cpp"
    train_text = trains.read_text()
    spawn_marker = "        t->lastMovementTime = getTime();\n"
    if train_text.count(spawn_marker) != 1:
        raise SystemExit("Pinned train-spawn trace marker changed")
    train_text = train_text.replace(
        "#include <cstdlib>\n",
        "#include <cstdlib>\n#include <cstdio>\n#include <emscripten/emscripten.h>\n", 1,
    )
    train_array = "std::array<Train, 20> g_trains;\n"
    if train_text.count(train_array) != 1:
        raise SystemExit("Pinned train-array trace marker changed")
    train_text = train_text.replace(
        train_array,
        train_array
        + 'static bool ojTracePauseDispatch = false;\n'
        + 'extern "C" EMSCRIPTEN_KEEPALIVE void oj_trace_pause_dispatch(int enabled) {\n'
        + '    ojTracePauseDispatch = enabled != 0;\n'
        + '}\n'
        + 'extern "C" EMSCRIPTEN_KEEPALIVE int oj_trace_active_train_count() {\n'
        + '    int count = 0;\n'
        + '    for (const Train& train : g_trains) if (!train.isFreeSlot) ++count;\n'
        + '    return count;\n'
        + '}\n'
        + 'extern "C" EMSCRIPTEN_KEEPALIVE int oj_trace_waiting_train_count() {\n'
        + '    int count = 0;\n'
        + '    for (int i = 0; i < g_entranceCount; ++i) count += g_entrances[i].waitingTrainsCount;\n'
        + '    return count;\n'
        + '}\n',
        1,
    )
    waiting_marker = "void tryRunWaitingTrains()\n{\n"
    if train_text.count(waiting_marker) != 1:
        raise SystemExit("Pinned private dispatch-pause marker changed")
    train_text = train_text.replace(
        waiting_marker,
        waiting_marker + "    if (ojTracePauseDispatch) return;\n",
        1,
    )
    automatic_spawn_marker = "void spawnNewTrain()\n{\n"
    if train_text.count(automatic_spawn_marker) != 1:
        raise SystemExit("Pinned automatic train-spawn marker changed")
    train_text = train_text.replace(
        automatic_spawn_marker,
        automatic_spawn_marker + "    if (ojTracePauseDispatch) return;\n", 1,
    )
    trains.write_text(train_text.replace(
        spawn_marker,
        spawn_marker + '        std::fprintf(stderr, "OJ train spawned from %d to %d at year %d slot %d\\n", '
        'entranceIdx, dstEntranceIdx, t->year, static_cast<int>(t - g_trains.data()));\n',
        1,
    ))
    train_text = trains.read_text()
    next_train_function = "/* 16a6:08bb */\nvoid tryRunWaitingTrains()"
    if train_text.count(next_train_function) != 1:
        raise SystemExit("Pinned targeted-service trace marker changed")
    trains.write_text(train_text.replace(
        next_train_function,
        'extern "C" EMSCRIPTEN_KEEPALIVE int oj_trace_spawn_third_service() {\n'
        '    if (g_entranceCount < 3 || !noTrainsExist() || !entranceIsFree(1)) return -1;\n'
        '    Train* train = spawnTrain(1);\n'
        '    if (!train) return -2;\n'
        '    for (int i = 0; i < train->carriageCnt; ++i)\n'
        '        train->carriages[i].dstEntranceIdx = 2;\n'
        '    const int slot = static_cast<int>(train - g_trains.data());\n'
        '    std::fprintf(stderr, "OJ trace forced third service slot %d\\n", slot);\n'
        '    std::fprintf(stderr, "OJ train spawned from 1 to 2 at year %d slot %d\\n",\n'
        '        train->year, slot);\n'
        '    return slot;\n'
        '}\n'
        'extern "C" EMSCRIPTEN_KEEPALIVE int oj_trace_spawn_cross_branch_service() {\n'
        '    if (g_entranceCount < 3 || !noTrainsExist() || !entranceIsFree(0)) return -1;\n'
        '    Train* train = spawnTrain(0);\n'
        '    if (!train) return -2;\n'
        '    for (int i = 0; i < train->carriageCnt; ++i)\n'
        '        train->carriages[i].dstEntranceIdx = 2;\n'
        '    const int slot = static_cast<int>(train - g_trains.data());\n'
        '    std::fprintf(stderr, "OJ trace forced cross-branch service slot %d\\n", slot);\n'
        '    std::fprintf(stderr, "OJ train spawned from 0 to 2 at year %d slot %d\\n",\n'
        '        train->year, slot);\n'
        '    return slot;\n'
        '}\n\n' + next_train_function,
        1,
    ))
    movement = source / "src/game/move_trains.cpp"
    movement_text = movement.read_text()
    delivered_marker = "                startHeaderFieldAnimation(HeaderFieldId::Trains, 1);\n"
    if movement_text.count(delivered_marker) != 1:
        raise SystemExit("Pinned train-delivery trace marker changed")
    movement_text = movement_text.replace("#include <cstdlib>\n", "#include <cstdlib>\n#include <cstdio>\n", 1)
    delete_marker = "            deleteTrain(train);\n"
    if movement_text.count(delete_marker) != 1:
        raise SystemExit("Pinned train-completion marker changed")
    movement_text = movement_text.replace(
        delete_marker,
        '            std::fprintf(stderr, "OJ train completed slot %d dst %d arrived %d\\n", '
        'static_cast<int>(&train - g_trains.data()), '
        'train.carriages[0].dstEntranceIdx, '
        'train.head.rail == &dstEntrance.rail ? 1 : 0);\n' + delete_marker,
        1,
    )
    movement.write_text(movement_text.replace(
        delivered_marker,
        '                std::fprintf(stderr, "OJ train delivered\\n");\n'
        + delivered_marker,
        1,
    ))

build = output / "build"
build.mkdir(parents=True)
subprocess.run(["emcmake", "cmake", "-DCMAKE_BUILD_TYPE=Release", str(source)], cwd=build, check=True)
subprocess.run(["cmake", "--build", ".", "-j4"], cwd=build, check=True)

files = []
for name in ("resl.js", "resl.wasm"):
    data = (build / name).read_bytes()
    files.append({"path": name, "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()})
for relative in ("CMakeLists.txt", "src/graphics/text.cpp", "src/system/driver/sdl/driver.cpp", "src/system/driver/sdl/audio.cpp", "src/system/driver/sdl/mouse.cpp", "src/system/driver/sdl/video.cpp", "src/system/filesystem.cpp", "src/game/melody.cpp", "src/game/drawing.cpp", "src/game/init.cpp", "src/game/main_loop.cpp", "src/game/mouse/mouse.cpp", "src/game/move_trains.cpp", "src/game/road_construction.cpp", "src/game/static_object.cpp", "src/game/train.cpp", "src/ui/components/dialog.cpp", "src/ui/components/status_bar.cpp", "src/ui/main_menu.cpp", "src/ui/loading_screen.cpp"):
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
retained_geometry = []
for name in sorted(RETAINED_ENGINE_GEOMETRY_TABLES):
    data = (checkout / "src/game/resources" / name).read_bytes()
    retained_geometry.append({
        "path": f"src/game/resources/{name}",
        "bytes": len(data),
        "sha256": hashlib.sha256(data).hexdigest(),
        "classification": "provisional GPL engine geometry, not independent presentation art",
    })

record = {
    "sourceRevision": REVISION,
    "toolchain": toolchain,
    "files": files,
    "replacementAssets": asset_manifest["files"],
    "replacementGlyphs": glyph_manifest["files"],
    "replacementCursor": cursor_record,
    "replacementScenario": scenario_manifest["files"],
    "replacementEntranceSchedule": entrance_choices,
    "replacementStarterRoute": starter_route,
    "replacementForest": {"maximumTrees": 32, "minimumSpacingPixels": 36},
    "replacementPaletteRGB": palette,
    "originalExternalResourcesBundled": False,
    "listedEmbeddedGlyphTablesReplaced": True,
    "embeddedVisualsReplaced": not bool(embedded_visuals),
    "unreplacedEmbeddedVisuals": embedded_visuals,
    "retainedEngineGeometryTables": retained_geometry,
    "sourceInventoryGuard": {
        "nonResourceByteArrays": sorted(f"{path}:{name}" for path, name in non_resource_byte_arrays),
        "literalResourceReads": sorted(f"{kind}:{name}" for kind, name in literal_file_reads),
        "sourceFileExtensions": [".c", ".cpp", ".h"],
    },
    "audioBackend": "null",
    "classicModuleForSharedPlayer": True,
    "saveRoot": "/persistent",
    "browserTested": False,
    "privateTraceEnabled": os.environ.get("OPEN_JUNCTION_TRACE") == "1",
    "shortBrowserLoadingScreen": True,
    "releaseReady": False,
    "blockers": [
        "Finish retained engine-geometry classification and dynamic drawing review",
        "Inspect signals, trains, small labels, and redraw across additional gameplay states",
        "Test conflicting natural services and longer independent scenario progression",
        "Test organic year advancement and loss beyond trace-only transition checks",
        "Publish corresponding source, asset manifests, and checksums after the release gate passes",
    ],
}
(output / "build-record.json").write_text(json.dumps(record, indent=2) + "\n")
print(json.dumps(record, indent=2))
