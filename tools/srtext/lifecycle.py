"""Publish validated data with rollback, and discard only known source downloads."""
import os
import shutil
from pathlib import Path
from tempfile import TemporaryDirectory

from .source import SOURCE_FILES


def cleanup_sources(cache):
    cache = Path(cache).resolve()
    for name in SOURCE_FILES:
        target = cache / name
        if target.exists():
            target.resolve().relative_to(cache)
            target.unlink()


def publish_files(stage, root, relative_files):
    stage, root = Path(stage).resolve(), Path(root).resolve()
    paths = []
    for relative in relative_files:
        source, target = stage / relative, root / relative
        source.resolve().relative_to(stage)
        target.resolve().relative_to(root)
        if not source.is_file():
            raise ValueError(f'Missing staged file: {relative}')
        paths.append((Path(relative), source, target))
    replaced = []
    with TemporaryDirectory(prefix='rollback-', dir=stage) as backup_name:
        backup = Path(backup_name)
        for relative, source, target in paths:
            if target.exists():
                saved = backup / relative
                saved.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(target, saved)
        try:
            for relative, source, target in paths:
                target.parent.mkdir(parents=True, exist_ok=True)
                os.replace(source, target)
                replaced.append((relative, target))
        except BaseException:
            for relative, target in reversed(replaced):
                saved = backup / relative
                if saved.exists():
                    shutil.copy2(saved, target)
                else:
                    target.unlink()
            raise
