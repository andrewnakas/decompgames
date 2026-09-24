#!/usr/bin/env python3
"""Find a short rail extension using reSL's pinned connection rules.

This is a geometry research aid, not proof that the in-game construction UI
accepts the route or that a train can complete it. Verify both in Chromium.
"""

from collections import deque
from pathlib import Path
import argparse
import re


def load_rules(path: Path):
    source = path.read_text()
    rows = []
    for section in re.findall(r"\{ // [0-5]\n(.*?)\n    \}", source, re.S):
        entries = [tuple(map(int, groups)) for groups in re.findall(
            r"\{\s*(-?\d+),\s*(-?\d+),\s*(-?\d+),\s*(-?\d+),\s*(-?\d+)\s*\}",
            section,
        )]
        rows.append(entries)
    if len(rows) != 6 or any(len(row) != 6 for row in rows):
        raise ValueError("Pinned six-by-six rail connection table changed")
    return rows


def neighbors(node, rules):
    x, y, kind = node
    for next_kind, dx, dy, _slot1, _slot2 in rules[kind]:
        next_x, next_y = x + dx, y + dy
        if 1 <= next_x <= 9 and 1 <= next_y <= 9:
            yield next_x, next_y, next_kind


def path_to_target(existing, target, rules):
    queue = deque((node, [node]) for node in existing)
    visited = set(existing)
    while queue:
        node, path = queue.popleft()
        if node == target:
            return path
        for next_node in neighbors(node, rules):
            if next_node not in visited:
                visited.add(next_node)
                queue.append((next_node, path + [next_node]))
    return None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("rules", type=Path)
    args = parser.parse_args()
    rules = load_rules(args.rules)
    # First three stations plus player-built route to station 2 in the
    # independently authored Open Junction scenario.
    existing = {
        (4, 1, 0), (1, 4, 1), (6, 3, 0),
        (3, 1, 5), (2, 2, 3), (1, 3, 5),
        (4, 1, 2), (5, 2, 4),
    }
    # The remaining three station rails are built by normal year progression.
    # Iterative plans are provisional: each earlier route still needs browser
    # construction and delivery tests before relying on a later route.
    actual_stations = [(3, 6, 1), (8, 5, 0), (5, 8, 1)]
    for number, station in enumerate(actual_stations, start=4):
        path = path_to_target(existing, station, rules)
        if not path:
            raise SystemExit(f"No geometric path to station {number}")
        additions = [node for node in path if node not in existing and node != station]
        print(f"Station {number} candidate path:", path)
        print("  player-built rails:", additions)
        print("  station rail appears during progression:", station)
        existing.update(path)


if __name__ == "__main__":
    main()
