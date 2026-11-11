"""Validate then publish using a same-volume directory rename with rollback."""
import shutil
import json
import tempfile
from pathlib import Path

from .validate import validate_collection


def publish_collection(collection, site, assets=None):
    collection, site = Path(collection).resolve(), Path(site).resolve()
    report = validate_collection(collection)
    manifest = json.loads((collection / 'manifest.json').read_text(encoding='utf-8'))
    urls = set(manifest.get('assets', {}).get('paths', {}).values())
    for category in manifest.get('assets', {}).get('entities', {}).values():
        for entity in category.values():
            urls.update(entity.values())
    urls.update(manifest.get('assets', {}).get('skills', {}).values())
    for url in urls - {''}:
        relative = url.lstrip('/')
        candidates = [(site / relative).resolve()]
        if assets:
            candidates.append((Path(assets).resolve() / relative).resolve())
        if not relative.startswith('images/') or '..' in Path(relative).parts or not any(candidate.is_file() for candidate in candidates):
            raise ValueError('Referenced sprite missing or invalid: ' + url)
    destination = site / 'data'
    destination.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='.sr-update-', dir=site.parent) as temporary:
        staging = Path(temporary)
        prepared, backup = staging / 'prepared', staging / 'previous'
        shutil.copytree(collection, prepared)
        validate_collection(prepared)
        # 仅添加固定版本的资源；复制失败不会移除现有文件。
        if assets and (Path(assets) / 'images/resources').exists():
            shutil.copytree(Path(assets) / 'images/resources', site / 'images/resources', dirs_exist_ok=True)
        if destination.exists():
            destination.rename(backup)
        try:
            prepared.rename(destination)
        except BaseException:
            if destination.exists():
                shutil.rmtree(destination)
            if backup.exists():
                backup.rename(destination)
            raise
    return report
