#!/usr/bin/env python3
"""Draw independent CC0 reSL glyph tables without reading upstream art.

The fixed array sizes come from the engine's public C++ interfaces. Shapes are
original geometric symbols, not transformed or traced ShortLine imagery.
Usage: python generate-open-junction-glyphs.py OUTPUT_DIRECTORY
"""
from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path
import sys


def mask(width: int, height: int, pixel) -> list[int]:
    assert width % 8 == 0
    result = []
    for y in range(height):
        for x0 in range(0, width, 8):
            value = sum((1 << (7 - bit)) for bit in range(8) if pixel(x0 + bit, y))
            result.append(value)
    return result


def values(data: list[int]) -> str:
    return "{" + ", ".join(f"0x{value:02X}" for value in data) + "}"


def document(header: str, body: str) -> str:
    return (
        "// SPDX-License-Identifier: CC0-1.0\n"
        "// Independently drawn geometric art for Open Junction.\n"
        f'#include "{header}"\n'
        "#include <graphics/glyph.h>\n"
        "namespace resl {\n" + body + "\n} // namespace resl\n"
    )


# A compact, original five-column drafting font. Rows are specified as bit
# patterns so neither font table depends on an installed or upstream font.
FONT = {
    "A": "01110/10001/10001/11111/10001/10001/10001",
    "B": "11110/10001/10001/11110/10001/10001/11110",
    "C": "01111/10000/10000/10000/10000/10000/01111",
    "D": "11110/10001/10001/10001/10001/10001/11110",
    "E": "11111/10000/10000/11110/10000/10000/11111",
    "F": "11111/10000/10000/11110/10000/10000/10000",
    "G": "01111/10000/10000/10111/10001/10001/01111",
    "H": "10001/10001/10001/11111/10001/10001/10001",
    "I": "11111/00100/00100/00100/00100/00100/11111",
    "J": "00111/00010/00010/00010/10010/10010/01100",
    "K": "10001/10010/10100/11000/10100/10010/10001",
    "L": "10000/10000/10000/10000/10000/10000/11111",
    "M": "10001/11011/10101/10101/10001/10001/10001",
    "N": "10001/11001/10101/10011/10001/10001/10001",
    "O": "01110/10001/10001/10001/10001/10001/01110",
    "P": "11110/10001/10001/11110/10000/10000/10000",
    "Q": "01110/10001/10001/10001/10101/10010/01101",
    "R": "11110/10001/10001/11110/10100/10010/10001",
    "S": "01111/10000/10000/01110/00001/00001/11110",
    "T": "11111/00100/00100/00100/00100/00100/00100",
    "U": "10001/10001/10001/10001/10001/10001/01110",
    "V": "10001/10001/10001/10001/10001/01010/00100",
    "W": "10001/10001/10001/10101/10101/10101/01010",
    "X": "10001/10001/01010/00100/01010/10001/10001",
    "Y": "10001/10001/01010/00100/00100/00100/00100",
    "Z": "11111/00001/00010/00100/01000/10000/11111",
    "0": "01110/10001/10011/10101/11001/10001/01110",
    "1": "00100/01100/00100/00100/00100/00100/01110",
    "2": "01110/10001/00001/00010/00100/01000/11111",
    "3": "11110/00001/00001/01110/00001/00001/11110",
    "4": "00010/00110/01010/10010/11111/00010/00010",
    "5": "11111/10000/10000/11110/00001/00001/11110",
    "6": "01111/10000/10000/11110/10001/10001/01110",
    "7": "11111/00001/00010/00100/01000/01000/01000",
    "8": "01110/10001/10001/01110/10001/10001/01110",
    "9": "01110/10001/10001/01111/00001/00001/11110",
    " ": "00000/00000/00000/00000/00000/00000/00000",
    ".": "00000/00000/00000/00000/00000/00100/00100",
    ",": "00000/00000/00000/00000/00100/00100/01000",
    ":": "00000/00100/00100/00000/00100/00100/00000",
    "-": "00000/00000/00000/11111/00000/00000/00000",
    "+": "00000/00100/00100/11111/00100/00100/00000",
    "/": "00001/00001/00010/00100/01000/10000/10000",
    "!": "00100/00100/00100/00100/00100/00000/00100",
    "?": "01110/10001/00001/00010/00100/00000/00100",
    "=": "00000/11111/00000/11111/00000/00000/00000",
    "'": "00100/00100/01000/00000/00000/00000/00000",
    "(": "00010/00100/01000/01000/01000/00100/00010",
    ")": "01000/00100/00010/00010/00010/00100/01000",
    "[": "01110/01000/01000/01000/01000/01000/01110",
    "]": "01110/00010/00010/00010/00010/00010/01110",
    "#": "01010/01010/11111/01010/11111/01010/01010",
    "%": "11001/11001/00010/00100/01000/10011/10011",
    "_": "00000/00000/00000/00000/00000/00000/11111",
}


def font_rows(character: str) -> list[int]:
    pattern = FONT.get(character, FONT.get(character.upper(), FONT["?"]))
    rows = pattern.split("/")
    assert len(rows) == 7 and all(len(row) == 5 and set(row) <= {"0", "1"} for row in rows)
    return [int(row, 2) << 2 for row in rows for _ in range(2)]


def generate(output: Path) -> None:
    output.mkdir(parents=True, exist_ok=True)
    files: dict[str, str] = {}

    dispatcher = []
    for active in (False, True):
        # A person at a control desk; the active state raises a signal flag.
        fg = mask(16, 16, lambda x, y: (
            (5 <= x <= 8 and 2 <= y <= 5 and (x in (5, 8) or y in (2, 5)))
            or (6 <= x <= 7 and 6 <= y <= 11)
            or (3 <= x <= 10 and y == 8)
            or (4 <= x <= 9 and y == 12)
            or (x in (5, 8) and 13 <= y <= 15)
            or (active and x == 12 and 2 <= y <= 13)
            or (active and 12 <= x <= 15 and y in (2, 3))
        ))
        bg = mask(16, 16, lambda x, y: 1 <= x <= 14 and y == 15)
        dispatcher.append(f"    {{{values(fg)}, {values(bg)}}}")
    files["dispatcher_glyph.cpp"] = document(
        "dispatcher_glyph.h",
        "const DispatcherGlyph g_dispatcherGlyphs[2] = {\n" + ",\n".join(dispatcher) + "\n};",
    )

    impasses = []
    for direction in (-1, 1):
        fg = mask(8, 16, lambda x, y: (
            (1 <= x <= 6 and y in (2, 13))
            or (x in (1, 6) and 2 <= y <= 13)
            or (4 <= y <= 11 and x == (y - 3 if direction > 0 else 11 - y) % 6 + 1)
        ))
        bg = mask(8, 16, lambda x, y: 2 <= x <= 5 and y in (6, 7, 8, 9))
        impasses.append(f"    {{{values(fg)}, {values(bg)}}}")
    files["impasse_glyph.cpp"] = document(
        "impasse_glyph.h",
        "const ImpasseGlyph g_impasseGlyphs[2] = {\n" + ",\n".join(impasses) + "\n};",
    )

    objects = []
    for variant in range(5):
        roof = 4 + variant % 3
        fg = mask(16, 16, lambda x, y: (
            (roof <= y <= 9 and abs(x - 7) == y - roof)
            or (4 <= x <= 11 and y in (10, 15))
            or (x in (4, 11) and 10 <= y <= 15)
            or (x in (7, 8) and 12 <= y <= 15)
        ))
        bg = mask(16, 16, lambda x, y: 5 <= x <= 10 and 11 <= y <= 14)
        objects.append(f"    {{{values(fg)}, {values(bg)}}}")
    houses = "const StaticObjectGlyph g_houseGlyphs[5] = {\n" + ",\n".join(objects) + "\n};\n"
    trees = []
    for variant in range(4):
        crown = 3 + variant % 2
        def tree_radius(y: int) -> int:
            return (y - crown) // 2 + 1
        fg = mask(16, 16, lambda x, y: (
            (crown <= y <= 11 and abs(x - 7) == tree_radius(y))
            or (x in (7, 8) and 10 <= y <= 15)
        ))
        bg = mask(16, 16, lambda x, y: (
            crown <= y <= 11 and abs(x - 7) < tree_radius(y)
        ))
        trees.append(f"    {{{values(fg)}, {values(bg)}}}")
    files["static_object_glyph.cpp"] = document(
        "static_object_glyph.h",
        houses + "const StaticObjectGlyph g_treeGlyphs[4] = {\n" + ",\n".join(trees) + "\n};",
    )

    # Two directional completion markers: a flag with an asymmetric tail.
    completion = []
    for direction in (-1, 1):
        data = mask(24, 25, lambda x, y: (
            (x == 11 and 2 <= y <= 22)
            or (8 <= x <= 14 and y in (2, 22))
            or (3 <= y <= 11 and y - 3 <= (x - 12) * direction <= 8)
        ))
        completion.append(values(data))
    files["train_finished_exclamation_glyph.cpp"] = document(
        "train_finished_exclamation_glyph.h",
        f"static const GlyphData<3, 25> leftData = {completion[0]};\n"
        f"static const GlyphData<3, 25> rightData = {completion[1]};\n"
        "const Glyph& g_glyphTrainFinishedLeftEntrance = leftData;\n"
        "const Glyph& g_glyphTrainFinishedRightEntrance = rightData;",
    )

    small_font = [value for code in range(256) for value in font_rows(chr(code))]
    assert len(small_font) == 256 * 14
    files["small_font.cpp"] = document(
        "small_font.h",
        "const std::uint8_t g_font14Data[] = " + values(small_font) + ";",
    )
    text_glyphs = [font_rows(chr(code)) for code in range(32, 179)]
    assert len(text_glyphs) == 147 and all(len(glyph) == 14 for glyph in text_glyphs)
    text_body = "\n".join(
        f"static const std::uint8_t glyph{index}[14] = {values(rows)};"
        for index, rows in enumerate(text_glyphs)
    )
    text_body += "\nconst TextGlyph g_textGlyphs[147] = {\n"
    text_body += ",\n".join(
        f"    {{0, 14, 8, glyph{index}}}" for index in range(147)
    ) + "\n};"
    files["text_glyphs.cpp"] = document("text_glyphs.h", text_body)

    semaphores = []
    for side in (-1, 1):
        states = []
        for raised in (False, True):
            arm_y = 3 if raised else 7
            frame = mask(8, 15, lambda x, y: (
                (x in (3, 4) and 3 <= y <= 14)
                or (y == 14 and 1 <= x <= 6)
                or (y == arm_y and 1 <= x <= 6)
            ))
            fill = mask(8, 15, lambda x, y: (
                (x == 3 and 5 <= y <= 13)
                or (y == arm_y and x in (1, 6))
            ))
            lamp = mask(16, 4, lambda x, y: (
                (5 <= x <= 10 and y in (0, 3))
                or (x in (5, 10) and y in (1, 2))
            ))
            states.append(
                f"        {{-4, -14, {-4 if side < 0 else 3}, {arm_y}, "
                f"{values(frame)}, {values(fill)}, {values(lamp)}}}"
            )
        semaphores.append("    {\n" + ",\n".join(states) + "\n    }")
    files["semaphore_glyph.cpp"] = document(
        "semaphore_glyph.h",
        "const SemaphoreGlyph g_semaphoreGlyphs[2][2] = {\n"
        + ",\n".join(semaphores) + "\n};",
    )

    # This is a functional full-bit mask used when erasing sprites. Generate
    # it anew so no upstream data table is copied into the release candidate.
    files["glyph_empty_background.cpp"] = document(
        "glyph_empty_background.h",
        "const std::uint8_t g_glyphEmptyBackground[32] = "
        + values([0xFF] * 32) + ";",
    )

    # Six possible connections among four isometric edge ports. Each rail is
    # drafted as two segments through the center of a 192x43 tile canvas.
    # Coordinates are deliberately new geometry, rather than pixel extraction.
    ports = ((8, 0), (8, 42), (184, 0), (184, 42))
    connections = ((0, 3), (1, 2), (0, 2), (1, 3), (0, 1), (2, 3))

    def segment_distance(x: int, y: int, start, end) -> float:
        dx, dy = end[0] - start[0], end[1] - start[1]
        t = max(0.0, min(1.0, ((x - start[0]) * dx + (y - start[1]) * dy) / (dx * dx + dy * dy)))
        return math.hypot(x - start[0] - t * dx, y - start[1] - t * dy)

    def route_distance(x: int, y: int, first, second) -> float:
        center = (96, 21)
        return min(segment_distance(x, y, first, center), segment_distance(x, y, center, second))

    rail_defs = []
    rail_rows = []
    for index, (a, b) in enumerate(connections):
        alternate = [port for port in range(4) if port not in (a, b)]
        predicates = (
            lambda d: 1.6 <= d <= 3.5,  # dark parallel steel edges
            lambda d: d <= 4.5,           # inner ballast
            lambda d: d <= 6.5,           # outer ballast
        )
        for role, predicate in enumerate(predicates):
            pixels = mask(192, 43, lambda x, y: predicate(route_distance(x, y, ports[a], ports[b])))
            rail_defs.append(
                f"static RailGlyphData<24, 43> rail_{index}_{role} = "
                f"{{-96, -21, {values(pixels)}}};"
            )
        for side, port in enumerate(alternate):
            pixels = mask(192, 43, lambda x, y: segment_distance(x, y, (96, 21), ports[port]) <= 2.5)
            rail_defs.append(
                f"static RailGlyphData<24, 43> rail_{index}_{side + 3} = "
                f"{{-96, -21, {values(pixels)}}};"
            )
        rail_rows.append(
            "    {" + ", ".join(
                f"reinterpret_cast<RailGlyph*>(&rail_{index}_{role})" for role in range(3)
            ) + ", {" + ", ".join(
                f"reinterpret_cast<RailGlyph*>(&rail_{index}_{role})" for role in (3, 4)
            ) + "}}"
        )
    rail_body = (
        "template <std::uint8_t W, std::uint8_t H> struct RailGlyphData {\n"
        "    std::int16_t dx; std::int16_t dy; GlyphData<W, H> glyph;\n};\n"
        + "\n".join(rail_defs)
        + "\nconst RailTexture railBackgrounds[6] = {\n"
        + ",\n".join(rail_rows) + "\n};"
    )
    files["rail_glyph.cpp"] = document("rail_glyph.h", rail_body)

    # A compact train family drafted from boxes, wheel circles, and windows.
    # The five animation angles share this neutral side view until gameplay
    # tests establish a useful, independently drawn rotation treatment.
    train_defs = []
    for kind in range(15):
        for direction in range(2):
            def oriented(x: int) -> int:
                return x if direction == 0 else 23 - x

            def outline(x: int, y: int) -> bool:
                x = oriented(x)
                if kind == 14:  # damaged carriage
                    return (x + 2 * y) % 7 == 0 and 4 <= y <= 14 and 2 <= x <= 21
                chassis = (2 <= x <= 21 and y in (6, 12)) or (x in (2, 21) and 6 <= y <= 12)
                wheel = (x in (5, 6, 17, 18) and 13 <= y <= 15)
                roof = (3 <= x <= 20 and y == 5)
                nose = kind <= 6 and x in (19, 20, 21) and 8 <= y <= 11
                return chassis or wheel or roof or nose

            def body(x: int, y: int) -> bool:
                x = oriented(x)
                return kind != 14 and 3 <= x <= 20 and 7 <= y <= 11

            def detail(x: int, y: int) -> bool:
                x = oriented(x)
                if kind == 14:
                    return (3 * x + y) % 11 == 0 and 3 <= y <= 13
                if 7 <= kind <= 9:
                    return y in (8, 9) and x in (5, 6, 10, 11, 15, 16)
                if 10 <= kind <= 13:
                    return y == 9 and 5 <= x <= 18 and x % 3 != 0
                return (y in (8, 9) and 5 <= x <= 10) or (kind in (2, 3) and x == 6 and 2 <= y <= 4)

            for layer, predicate in enumerate((outline, body, detail)):
                pixels = mask(24, 16, predicate)
                train_defs.append(
                    f"static const GlyphData<3, 16> train_{kind}_{direction}_{layer} = {values(pixels)};"
                )
    train_rows = []
    for kind in range(15):
        angles = []
        for _angle in range(5):
            directions = []
            for direction in range(2):
                directions.append(
                    "{24, 16, " + ", ".join(
                        f"train_{kind}_{direction}_{layer}" for layer in range(3)
                    ) + "}"
                )
            angles.append("{" + ", ".join(directions) + "}")
        train_rows.append("    {" + ", ".join(angles) + "}")
    files["train_glyph.cpp"] = document(
        "train_glyph.h",
        "\n".join(train_defs) + "\nconst TrainGlyph g_trainGlyphs[15][5][2] = {\n"
        + ",\n".join(train_rows) + "\n};",
    )

    # SDL's cursor decoder reads the two bytes in each row in reverse order.
    # Draw a simple outlined pointer independently and serialize for patching
    # the non-resource source table in src/system/driver/sdl/mouse.cpp.
    def cursor_plane(pixel) -> list[int]:
        packed = mask(16, 16, pixel)
        return [value for row in range(16) for value in (packed[row * 2 + 1], packed[row * 2])]

    cursor = {
        "black": cursor_plane(lambda x, y: (
            (x == 1 and 1 <= y <= 13)
            or (y == 1 and 1 <= x <= 3)
            or (2 <= y <= 12 and x == min(12, 2 + y // 2))
            or (y == 13 and 1 <= x <= 9)
            or (x in (5, 6) and 11 <= y <= 15)
        )),
        "white": cursor_plane(lambda x, y: (
            2 <= y <= 11 and 2 <= x < min(12, 2 + y // 2)
        )),
    }
    cursor_data = (json.dumps(cursor, indent=2) + "\n").encode("utf-8")
    (output / "cursor.json").write_bytes(cursor_data)

    manifest = {
        "license": "CC0-1.0",
        "originalAssetsRead": False,
        "files": [],
        "cursor": {
            "name": "cursor.json", "bytes": len(cursor_data),
            "sha256": hashlib.sha256(cursor_data).hexdigest(),
        },
    }
    for name, source in sorted(files.items()):
        data = source.encode("utf-8")
        (output / name).write_bytes(data)
        manifest["files"].append({"name": name, "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()})
    (output / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Usage: generate-open-junction-glyphs.py OUTPUT_DIRECTORY")
    generate(Path(sys.argv[1]))
