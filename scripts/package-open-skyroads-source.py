#!/usr/bin/env python3
"""Make a deterministic source/data snapshot of the staged clean replacement."""
import argparse
import gzip
import hashlib
import io
import tarfile
from pathlib import Path


def package(source: Path, output: Path) -> None:
    files = sorted(path for path in source.rglob('*') if path.is_file())
    if not files or not (source / 'LICENSE').is_file():
        raise ValueError('Expected staged source and upstream LICENSE')
    record = source.parent / 'build-record.json'
    if not record.is_file():
        raise ValueError('Expected staged build input record')
    archive = io.BytesIO()
    with tarfile.open(fileobj=archive, mode='w', format=tarfile.USTAR_FORMAT) as tar:
        for path in files:
            data = path.read_bytes()
            info = tarfile.TarInfo('open-skyways-source/' + path.relative_to(source).as_posix())
            info.size = len(data)
            info.mode = 0o644
            info.mtime = 0
            info.uid = info.gid = 0
            info.uname = info.gname = ''
            tar.addfile(info, io.BytesIO(data))
        data = record.read_bytes()
        info = tarfile.TarInfo('open-skyways-source/build-record.json')
        info.size = len(data)
        info.mode = 0o644
        info.mtime = 0
        info.uid = info.gid = 0
        info.uname = info.gname = ''
        tar.addfile(info, io.BytesIO(data))
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open('wb') as target:
        with gzip.GzipFile(filename='', mode='wb', fileobj=target, mtime=0, compresslevel=9) as zipped:
            zipped.write(archive.getvalue())
    raw = output.read_bytes()
    print(f'{output}: {len(raw)} bytes sha256={hashlib.sha256(raw).hexdigest()} ({len(files) + 1} files)')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('staged_source', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    package(args.staged_source, args.output)
