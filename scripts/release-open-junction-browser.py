#!/usr/bin/env python3
"""Package an independently sourced, QA-gated Open Junction browser build.

This prepares immutable local assets. Deployment and production play testing are
separate steps; packaging alone does not count a release.
"""
from __future__ import annotations

import gzip
import hashlib
import io
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tarfile

REVISION = "470cca330ee9abcf6173c843f4c89686c0c7e525"
RECIPE_FILES = (
    ".github/workflows/open-junction-feasibility.yml",
    "scripts/build-resl-browser.py",
    "scripts/release-open-junction-browser.py",
    "scripts/generate-open-junction-assets.py",
    "scripts/generate-open-junction-glyphs.py",
    "scripts/generate-open-junction-scenario.py",
    "docs/resl-source-data-audit.md",
    "docs/resl-replacement-integration.md",
    "docs/open-junction-player-guide-draft.md",
)
BUILD_INPUTS = RECIPE_FILES[1:2] + RECIPE_FILES[3:6]


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def add_bytes(archive: tarfile.TarFile, name: str, data: bytes) -> None:
    item = tarfile.TarInfo(name)
    item.size = len(data)
    item.mode = 0o644
    item.mtime = 0
    archive.addfile(item, io.BytesIO(data))


if len(sys.argv) != 4:
    raise SystemExit("Usage: release-open-junction-browser.py BUILD_OUTPUT FULL_CI_RUN PLAYER_CI_RUN")

workspace = Path(__file__).resolve().parent.parent
build = Path(sys.argv[1]).resolve()
record_bytes = (build / "build-record.json").read_bytes()
record = json.loads(record_bytes)
source = build / "replacement-source"
if (record.get("sourceRevision") != REVISION
        or record.get("privateTraceEnabled") is not False
        or record.get("audioBackend") != "null"
        or record.get("originalExternalResourcesBundled") is not False
        or record.get("originalMelodySequencesReplaced") is not True
        or record.get("unreplacedEmbeddedVisuals") != []
        or record.get("replacementStartingFunds") != 300
        or record.get("replacementButtonGlyphs", {}).get("count") != 4):
    raise SystemExit("Open Junction release build inventory failed")
if {path.name for path in source.iterdir()} != {
    "CMakeLists.txt", "LICENSE", "README.md", "src", "resources"
} or {path.name for path in (source / "resources").iterdir()} != {"open-junction"}:
    raise SystemExit("Unexpected engine source or original resource root")
if (source / "src/game/resources/scripts").exists() or (source / "src/game/resources/utility").exists():
    raise SystemExit("Executable-extraction utilities appeared in source")
if sha((source / "src/game/melody.cpp").read_bytes()) != record["silentMelodySourceSha256"]:
    raise SystemExit("Silent melody source mismatch")
button_source = (source / "src/ui/components/button.cpp").read_text()
if "1d7d:884a" in button_source or button_source.count("Independently drafted rectangular UI mask") != 4:
    raise SystemExit("Original button glyphs remain in source")
for group, directory in (
    ("replacementAssets", source / "resources/open-junction"),
    ("replacementGlyphs", source / "src/game/resources"),
    ("replacementScenario", source / "src/game/resources"),
):
    for item in record[group]:
        name = item["name"]
        if Path(name).name != name:
            raise SystemExit(f"Unexpected generated path: {name}")
        data = (directory / name).read_bytes()
        if len(data) != item["bytes"] or sha(data) != item["sha256"]:
            raise SystemExit(f"Generated data mismatch: {name}")

files = []
for name in ("resl.js", "resl.wasm"):
    data = (build / "build" / name).read_bytes()
    listed = next((item for item in record["files"] if item["path"] == name), None)
    if listed is None or listed["bytes"] != len(data) or listed["sha256"] != sha(data):
        raise SystemExit(f"Build-record hash mismatch for {name}")
    files.append({"path": name, "bytes": len(data), "sha256": sha(data)})

for item in record["files"]:
    if item["path"] in {"resl.js", "resl.wasm"}:
        continue
    path = build / item["path"]
    data = path.read_bytes()
    if len(data) != item["bytes"] or sha(data) != item["sha256"]:
        raise SystemExit(f"Patched-source hash mismatch for {item['path']}")

recipe_revision = subprocess.check_output(
    ["git", "rev-parse", "HEAD"], cwd=workspace, text=True).strip()
evidence = []
for label, run_id in (("full muted gameplay", sys.argv[2]),
                      ("uninstrumented shared player", sys.argv[3])):
    result = json.loads(subprocess.check_output(
        ["gh", "run", "view", run_id, "--json", "conclusion,headSha"],
        cwd=workspace, text=True))
    if result["conclusion"] != "success" or len(result["headSha"]) != 40:
        raise SystemExit(f"{label} run is not successful")
    for relative in BUILD_INPUTS:
        tested = subprocess.check_output(
            ["git", "show", f"{result['headSha']}:{relative}"], cwd=workspace)
        if tested != (workspace / relative).read_bytes():
            raise SystemExit(f"{label} run used a different {relative}")
    evidence.append({"scope": label, "run": int(run_id),
                     "url": f"https://github.com/andrewnakas/decompgames/actions/runs/{run_id}",
                     "recipeRevision": result["headSha"]})

package_seed = json.dumps({"files": files, "recipeRevision": recipe_revision},
                          sort_keys=True, separators=(",", ":")).encode()
package_revision = f"{REVISION[:12]}-{sha(package_seed)[:10]}"
base = f"/runtime/shortline/{package_revision}/"
runtime = workspace / "public" / base.lstrip("/")
runtime.mkdir(parents=True, exist_ok=True)
for item in files:
    shutil.copyfile(build / "build" / item["path"], runtime / item["path"])

review = {
    "game": "Open Junction",
    "engine": "reSL",
    "engineLicense": "GPL-3.0",
    "replacementLicense": "CC0-1.0",
    "sourceRevision": REVISION,
    "recipeRevision": recipe_revision,
    "evidence": evidence,
    "limits": [
        "Uninterrupted 1800-to-2000 progression has not been tested.",
        "The full repeat-level campaign and audible audio have not been tested.",
        "Production gameplay must pass before this package is counted as released.",
    ],
    "buildRecordNote": "The build record was emitted before end-to-end QA and retains releaseReady=false; successful run evidence and production verification are recorded separately.",
}
source_name = f"open-junction-{package_revision}"
source_path = workspace / "public" / "sources" / f"{source_name}.tar.gz"
source_path.parent.mkdir(parents=True, exist_ok=True)
instructions = (
    "Open Junction corresponding source and independent replacement data\n"
    f"Engine: https://github.com/konovalov-aleks/reSL at {REVISION}\n"
    f"Decomp Games recipe: https://github.com/andrewnakas/decompgames at {recipe_revision}\n"
    f"Toolchain: {record['toolchain']}\n"
    "Engine license: GPL-3.0. Independent replacement assets: CC0-1.0.\n"
    "engine/ is the exact patched source and generated assets used for the WASM.\n"
    "decompgames/ contains the build recipe, generators, workflow, audit, and guide.\n"
    "Activate Emscripten 6.0.1; from decompgames/ run:\n"
    "  python3 scripts/generate-open-junction-assets.py /tmp/oj-assets\n"
    "  python3 scripts/generate-open-junction-glyphs.py /tmp/oj-glyphs\n"
    "  python3 scripts/generate-open-junction-scenario.py /tmp/oj-scenario\n"
    "  python3 scripts/build-resl-browser.py ENGINE_CHECKOUT BUILD_OUTPUT /tmp/oj-assets /tmp/oj-glyphs /tmp/oj-scenario\n"
    "The source build excludes original upstream external game resources and uses a null audio backend.\n"
).encode()
with source_path.open("wb") as raw, gzip.GzipFile(fileobj=raw, mode="wb", mtime=0) as gz:
    with tarfile.open(fileobj=gz, mode="w") as archive:
        for path in sorted(source.rglob("*")):
            if path.is_file():
                add_bytes(archive, f"{source_name}/engine/{path.relative_to(source).as_posix()}",
                          path.read_bytes())
        for relative in RECIPE_FILES:
            add_bytes(archive, f"{source_name}/decompgames/{relative}",
                      (workspace / relative).read_bytes())
        add_bytes(archive, f"{source_name}/build-record.json", record_bytes)
        add_bytes(archive, f"{source_name}/release-review.json",
                  (json.dumps(review, indent=2) + "\n").encode())
        add_bytes(archive, f"{source_name}/BUILD-DECOMPGAMES.txt", instructions)

source_data = source_path.read_bytes()
manifest = {
    "id": "shortline", "engine": "resl", "packageRevision": package_revision,
    "repository": "https://github.com/konovalov-aleks/reSL",
    "sourceRevision": REVISION, "recipeRevision": recipe_revision,
    "toolchain": record["toolchain"],
    "recipe": "scripts/build-resl-browser.py",
    "sourceArchive": f"/sources/{source_path.name}",
    "sourceArchiveBytes": len(source_data),
    "sourceArchiveSha256": sha(source_data),
    "base": base, "script": "resl.js", "files": files,
    "requirements": ["WebAssembly", "Keyboard", "Mouse"],
    "saveVersion": "open-junction-replacement-v1",
    "saveRoots": ["/persistent"], "mountSave": True,
    "assets": [], "args": ["--windowed"], "audioBackend": "null",
    "replacementData": {
        "license": "CC0-1.0",
        "externalAssets": record["replacementAssets"],
        "glyphs": record["replacementGlyphs"],
        "scenario": record["replacementScenario"],
        "buttons": record["replacementButtonGlyphs"],
    },
    "verificationEvidence": evidence,
}
(workspace / "public" / "manifests" / "shortline.json").write_text(
    json.dumps(manifest, indent=2) + "\n")
print(json.dumps({"manifest": "/manifests/shortline.json", "packageRevision": package_revision,
                  "sourceArchiveSha256": manifest["sourceArchiveSha256"], "files": files}, indent=2))
