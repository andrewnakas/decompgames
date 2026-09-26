#!/usr/bin/env python3
"""Create a private corresponding-source archive for Open Junction review.

This does not publish binaries or mark the replacement candidate release-ready.
"""
from __future__ import annotations

import gzip
import hashlib
import io
import json
from pathlib import Path
import subprocess
import sys
import tarfile

REVISION = "470cca330ee9abcf6173c843f4c89686c0c7e525"
RECIPE_FILES = (
    "scripts/build-resl-browser.py",
    "scripts/generate-open-junction-assets.py",
    "scripts/generate-open-junction-glyphs.py",
    "scripts/generate-open-junction-scenario.py",
    "docs/resl-source-data-audit.md",
    "docs/resl-replacement-integration.md",
    "docs/open-junction-player-guide-draft.md",
)

if len(sys.argv) != 2:
    raise SystemExit("Usage: package-open-junction-private-source.py BUILD_OUTPUT")

workspace = Path(__file__).resolve().parent.parent
build = Path(sys.argv[1]).resolve()
record = json.loads((build / "build-record.json").read_text())
source = build / "replacement-source"
if (record.get("sourceRevision") != REVISION
        or record.get("originalExternalResourcesBundled") is not False
        or record.get("unreplacedEmbeddedVisuals") != []
        or record.get("audioBackend") != "null"
        or record.get("releaseReady") is not False):
    raise SystemExit("Private replacement-source gate failed")
if {path.name for path in source.iterdir()} != {
    "CMakeLists.txt", "LICENSE", "README.md", "src", "resources"
}:
    raise SystemExit("Unexpected source-copy roots")
if {path.name for path in (source / "resources").iterdir()} != {"open-junction"}:
    raise SystemExit("Original upstream resources appeared in the source copy")
if (source / "src/game/resources/scripts").exists() or (source / "src/game/resources/utility").exists():
    raise SystemExit("Executable-extraction utilities appeared in the source copy")

for item in record["files"]:
    path = (build / "build" / item["path"] if item["path"] in {"resl.js", "resl.wasm"}
            else build / item["path"])
    data = path.read_bytes()
    if len(data) != item["bytes"] or hashlib.sha256(data).hexdigest() != item["sha256"]:
        raise SystemExit(f"Build-record checksum mismatch: {item['path']}")

commit = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=workspace, text=True).strip()
archive_path = build / "open-junction-private-source.tar.gz"

def add_bytes(archive: tarfile.TarFile, name: str, data: bytes) -> None:
    info = tarfile.TarInfo(name)
    info.size = len(data)
    info.mode = 0o644
    info.mtime = 0
    archive.addfile(info, io.BytesIO(data))

instructions = (
    "PRIVATE FEASIBILITY ARCHIVE — NOT A RELEASE\n"
    "Engine: https://github.com/konovalov-aleks/reSL\n"
    f"Engine revision: {REVISION}\n"
    f"Decomp Games recipe revision: {commit}\n"
    f"Toolchain: {record['toolchain']}\n"
    "engine/ contains the exact patched source and independent external assets.\n"
    "decompgames/ contains the build recipe, generators, and current audit notes.\n"
    "The build-record contains SHA-256 hashes of the private WASM and JS.\n"
    "The candidate is not licensed for redistribution of upstream game assets.\n"
).encode()
with archive_path.open("wb") as raw, gzip.GzipFile(fileobj=raw, mode="wb", mtime=0) as gz:
    with tarfile.open(fileobj=gz, mode="w") as archive:
        for path in sorted(source.rglob("*")):
            if path.is_file():
                add_bytes(archive, f"open-junction/engine/{path.relative_to(source).as_posix()}", path.read_bytes())
        for relative in RECIPE_FILES:
            add_bytes(archive, f"open-junction/decompgames/{relative}", (workspace / relative).read_bytes())
        add_bytes(archive, "open-junction/build-record.json", (build / "build-record.json").read_bytes())
        add_bytes(archive, "open-junction/BUILD-DECOMPGAMES.txt", instructions)

data = archive_path.read_bytes()
print(json.dumps({
    "privateSourceArchive": str(archive_path),
    "bytes": len(data),
    "sha256": hashlib.sha256(data).hexdigest(),
    "engineRevision": REVISION,
    "recipeRevision": commit,
    "published": False,
}, indent=2))
