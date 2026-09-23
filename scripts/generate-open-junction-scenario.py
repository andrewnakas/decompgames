#!/usr/bin/env python3
"""Create an independent CC0 Open Junction board and train roster.

This is a private feasibility scenario until its gameplay loop is tested.
No upstream scenario tables or game data are read by this generator.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
import sys


def cpp(header: str, body: str, extra: str = "") -> str:
    return (
        "// SPDX-License-Identifier: CC0-1.0\n"
        "// Independently authored Open Junction scenario data.\n"
        f'#include "{header}"\n{extra}'
        "namespace resl {\n" + body + "\n} // namespace resl\n"
    )


def generate(output: Path) -> None:
    output.mkdir(parents=True, exist_ok=True)
    files: dict[str, str] = {}

    grid = []
    for x in range(11):
        row = []
        for y in range(11):
            usable = 1 <= x <= 9 and 1 <= y <= 9 and abs(x - y) <= 3 and 4 <= x + y <= 16
            row.append("0x3F" if usable else "0x00")
        grid.append("    {" + ", ".join(row) + "}")
    files["allowed_cursor_rail_types.cpp"] = cpp(
        "allowed_cursor_rail_types.h",
        "const std::uint8_t g_allowedRailCursorTypes[11][11] = {\n"
        + ",\n".join(grid) + "\n};",
        "#include <cstdint>\n",
    )

    # Two twenty-three-slot banks on opposing edges let the game's first two
    # entrance-selection indexes differ by at least 23 without sharing a side.
    rail_sites = []
    for right_side in (True, False):
        kinds = (0, 2, 3, 5) if right_side else (1, 2, 4, 5)
        bank = []
        for coordinate in range(1, 7):
            x, y = (coordinate + 3, coordinate) if right_side else (coordinate, coordinate + 3)
            for kind in kinds:
                bank.append((x, y, kind))
        rail_sites.extend(bank[:23])
    assert len(rail_sites) == 46 and len(set(rail_sites)) == 46
    assert all(
        1 <= x <= 9 and 1 <= y <= 9 and abs(x - y) == 3 and 4 <= x + y <= 16
        for x, y, _kind in rail_sites
    )
    assert all(x > y for x, y, _kind in rail_sites[:23])
    assert all(x < y for x, y, _kind in rail_sites[23:])
    rails = [f"    {{0, {x}, {y}, {kind}, 0}}" for x, y, kind in rail_sites]
    files["entrance_rails.cpp"] = cpp(
        "entrance_rails.h",
        "const RailInfo g_entranceRails[46] = {\n" + ",\n".join(rails) + "\n};",
        "#include <game/rail_info.h>\n",
    )

    # The glyphs extend around the tile center; broad bounds avoid stale rail
    # pixels during an incremental redraw. Tightening follows visual testing.
    boxes = ["    {-120, -32, 120, 72}" for _ in range(6)]
    files["chunk_bounding_boxes.cpp"] = cpp(
        "chunk_bounding_boxes.h",
        "const Rectangle g_chunkBoundingBoxes[6] = {\n"
        + ",\n".join(boxes) + "\n};",
        "#include <types/rectangle.h>\n",
    )

    names = (
        "Server", "AncientLocomotive", "SteamLocomotive", "Trolley",
        "DieselLocomotive", "ElectricLocomotive", "HighSpeedLocomotive",
        "AncientPassengerCarriage", "PassengerCarriage", "HighSpeedPassengerCarriage",
        "OpenFreightCarriage", "CoveredFreightCarriage", "PocketWagon", "TankWagon",
    )
    roster = []
    for kind in range(14):
        if kind == 0:
            first, last, speed = 1800, 2100, 5
            choices = (0, 0, 0, 0, 0)
        elif kind <= 6:
            first = 1800 + (kind - 1) * 22
            last = 2100
            speed = min(7, 3 + kind // 2)
            choices = tuple(7 + (kind + offset * 3) % 7 for offset in range(5))
        else:
            first = 1800 + (kind - 7) * 12
            last = 2100
            speed = 0
            choices = tuple(1 + (kind + offset) % 6 for offset in range(5))
        carriage_names = ", ".join(f"CarriageType::{names[value]}" for value in choices)
        roster.append(f"    {{{first}, {last}, {speed}, {{{carriage_names}}}}}")
    files["train_specification.cpp"] = cpp(
        "train_specification.h",
        "const TrainSpecification g_trainSpecifications[14] = {\n"
        + ",\n".join(roster) + "\n};",
        "#include <game/train.h>\n",
    )

    manifest = {"license": "CC0-1.0", "originalAssetsRead": False, "files": []}
    for name, source in sorted(files.items()):
        data = source.encode("utf-8")
        (output / name).write_bytes(data)
        manifest["files"].append({"name": name, "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()})
    (output / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Usage: generate-open-junction-scenario.py OUTPUT_DIRECTORY")
    generate(Path(sys.argv[1]))
