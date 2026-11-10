"""Validate then publish using a same-volume directory rename with rollback."""
import shutil
import json
import tempfile
from pathlib import Path

from .validate import validate_collection


def publish_collection(collection, site, routes=None, assets=None):
    collection, site = Path(collection).resolve(), Path(site).resolve()
    report = validate_collection(collection)
    if routes:
        catalog = json.loads(Path(routes).read_text(encoding='utf-8'))
        if not catalog.get('routes') or not catalog.get('pages') or any(entry.get('page') not in catalog['pages'] and not entry.get('redirect') for entry in catalog['routes'].values()):
            raise ValueError('Invalid route catalog; live data was not changed')
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
        if routes:
            shutil.copy2(routes, staging / 'routes.json')
            shutil.copy2(site / 'pages/routes.json', staging / 'previous-routes.json')
        # Assets only add immutable, version-pinned files; a failed copy cannot remove existing files.
        if assets and (Path(assets) / 'images/resources').exists():
            shutil.copytree(Path(assets) / 'images/resources', site / 'images/resources', dirs_exist_ok=True)
        if destination.exists():
            destination.rename(backup)
        try:
            prepared.rename(destination)
            if routes:
                (staging / 'routes.json').replace(site / 'pages/routes.json')
        except BaseException:
            if destination.exists():
                shutil.rmtree(destination)
            if backup.exists():
                backup.rename(destination)
            if routes and (staging / 'previous-routes.json').exists():
                shutil.copy2(staging / 'previous-routes.json', site / 'pages/routes.json')
            raise
    return report
