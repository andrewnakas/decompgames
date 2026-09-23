#!/usr/bin/env python3
"""Draw independent CC0 reSL glyph tables without reading upstream art.

The fixed array sizes come from the engine's public C++ interfaces. Shapes are
original geometric symbols, not transformed or traced ShortLine imagery.
Usage: python generate-open-junction-glyphs.py OUTPUT_DIRECTORY
"""
from __future__ import annotations

import hashlib
import json
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
        fg = mask(16, 16, lambda x, y: (
            (crown <= y <= 11 and abs(x - 7) <= (y - crown) // 2 + 1)
            or (x in (7, 8) and 10 <= y <= 15)
        ))
        bg = mask(16, 16, lambda x, y: 5 <= x <= 10 and y == 12)
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

    manifest = {"license": "CC0-1.0", "originalAssetsRead": False, "files": []}
    for name, source in sorted(files.items()):
        data = source.encode("utf-8")
        (output / name).write_bytes(data)
        manifest["files"].append({"name": name, "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()})
    (output / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Usage: generate-open-junction-glyphs.py OUTPUT_DIRECTORY")
    generate(Path(sys.argv[1]))
