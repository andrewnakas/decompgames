#!/usr/bin/env bash
# Investigation build only; not a release or permission to publish bundled data.
# Usage: source /path/to/emsdk/emsdk_env.sh; bash scripts/build-supaplex-baseline.sh /path/to/checkout
set -euo pipefail
repo="${1:?Pass an OpenSupaplex checkout path}"
revision=bad56a4e174e628643995284ea55d4c49af3137c
test "$(git -C "$repo" rev-parse HEAD)" = "$revision" || { echo 'Wrong source revision' >&2; exit 1; }
emcc --version | head -n 1 | grep -F '4.0.10' >/dev/null || { echo 'Baseline uses Emscripten 4.0.10' >&2; exit 1; }
make -C "$repo/wasm" -B -j2
sha256sum "$repo"/wasm/opensupaplex.{js,wasm,data}
