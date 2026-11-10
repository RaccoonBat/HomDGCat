"""Pinned, complete snapshots; archive inventory avoids truncated GitHub trees."""
import hashlib
import json
import urllib.request
import zipfile
from pathlib import Path, PurePosixPath

REPOSITORY = 'DimbreathBot/TurnBasedGameData'
REVISION = '74a7b96fba32f00cf495a5c00b0311bd02207aaf'
VERSION = '4.6.0'
ASSET_REPOSITORY = 'Mar-7th/StarRailRes'
ASSET_REVISION = 'dbe8cdfcfb0bf657b9fe1cf92d5537f118ccb487'
LANGUAGES = {'CH': ('CHS',), 'EN': ('EN',), 'JP': ('JP',), 'KR': ('KR_0', 'KR_1')}


def digest(path):
    value = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            value.update(chunk)
    return value.hexdigest()


def download_snapshot(destination, repository=REPOSITORY, revision=REVISION):
    destination = Path(destination)
    destination.parent.mkdir(parents=True, exist_ok=True)
    partial = destination.with_suffix('.part')
    url = f'https://codeload.github.com/{repository}/zip/{revision}'
    request = urllib.request.Request(url, headers={'User-Agent': 'HomDGCat-full-data/1.0'})
    try:
        with urllib.request.urlopen(request, timeout=120) as response, partial.open('wb') as stream:
            size = 0
            for chunk in iter(lambda: response.read(1024 * 1024), b''):
                stream.write(chunk)
                size += len(chunk)
                if size // (16 * 1024 * 1024) != (size - len(chunk)) // (16 * 1024 * 1024):
                    print(f'  Downloaded {size / 1048576:.0f} MiB', flush=True)
        with Snapshot(partial, revision):
            pass
        partial.replace(destination)
    except BaseException:
        partial.unlink(missing_ok=True)
        raise
    return destination


class Snapshot:
    def __init__(self, path, revision=REVISION):
        self.path = Path(path)
        self.archive = zipfile.ZipFile(path)
        self.files = {}
        expected = f'TurnBasedGameData-{revision}'
        for info in self.archive.infolist():
            if info.is_dir():
                continue
            parts = PurePosixPath(info.filename).parts
            if not parts or parts[0] != expected or '..' in parts:
                self.archive.close()
                raise ValueError(f'Unexpected snapshot member: {info.filename}')
            relative = '/'.join(parts[1:])
            if relative in self.files:
                raise ValueError(f'Duplicate snapshot file: {relative}')
            self.files[relative] = info
        for directory in ('Config/', 'ExcelOutput/', 'Stages/', 'Story/', 'TextMap/'):
            if not any(name.startswith(directory) for name in self.files):
                raise ValueError(f'Incomplete snapshot, missing {directory}')

    def read_json(self, name):
        with self.archive.open(self.files[name]) as stream:
            return json.load(stream)

    def inventory(self):
        return [{'path': name, 'bytes': info.file_size, 'crc32': f'{info.CRC:08x}'}
                for name, info in sorted(self.files.items())]

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        self.archive.close()
