"""One complete build, with temporary inputs removed after successful publication."""
import json
import shutil
import subprocess
import tempfile
import urllib.request
from pathlib import Path

from .assets import sync_assets
from .build import build_collection, write_json
from .historical import restore_historical
from .model import entity_aliases
from .publish import publish_collection
from .release import release_metadata
from .source import ASSET_REPOSITORY, ASSET_REVISION, download_snapshot
from .validate import seal_collection
from .versions import build_version_index


def fetch_json(url, destination):
    request = urllib.request.Request(url, headers={'User-Agent':'HomDGCat-full-data/1.0'})
    with urllib.request.urlopen(request, timeout=90) as response:
        value = json.load(response)
    destination.write_text(json.dumps(value, ensure_ascii=False), encoding='utf-8')


def complete_update(root, archive=None):
    root = Path(root).resolve()
    site = root / 'site'
    with tempfile.TemporaryDirectory(prefix='.sr-update-', dir=root) as directory:
        working = Path(directory)
        if archive:
            source = Path(archive).resolve()
        else:
            source = working / 'source.zip'
            download_snapshot(source)
        collection = working / 'collection'
        build_collection(source, collection)
        restore_historical(collection)
        tree = working / 'assets-tree.json'
        fetch_json(f'https://api.github.com/repos/{ASSET_REPOSITORY}/git/trees/{ASSET_REVISION}?recursive=1', tree)
        for name in ('characters','character_skills','character_ranks','light_cones','relic_sets','items'):
            fetch_json(f'https://raw.githubusercontent.com/{ASSET_REPOSITORY}/{ASSET_REVISION}/index_new/cn/{name}.json', working / ('asset-index-'+name+'.json'))
        assets = sync_assets(collection, site, tree, working, working / 'assets')
        release_metadata(collection)
        previous_aliases=site / 'data/metadata/legacy-text-ids.json'
        if previous_aliases.exists():
            shutil.copy2(previous_aliases,collection / 'metadata/legacy-text-ids.json')
        else:
            write_json(collection,'metadata/legacy-text-ids.json',{})
        manifest = json.loads((collection / 'manifest.json').read_text(encoding='utf-8'))
        manifest['assets'] = {key:value for key,value in assets.items() if key in ('entities','skills','paths','missingMonsters')}
        manifest['entityAliases'] = entity_aliases(collection, manifest)
        write_json(collection, 'manifest.json', manifest)
        previous_versions=site / 'data/metadata/versions.json'
        version_index=json.loads(previous_versions.read_text(encoding='utf-8')) if previous_versions.exists() else {}
        if version_index.get('revision')==manifest['revision']:
            shutil.copy2(previous_versions,collection / 'metadata/versions.json')
        else:
            build_version_index(collection,working / 'history',version_index.get('earlyEntityMetadata'))
        # 在封存前生成 React 使用的对白索引，纳入完整性校验。
        subprocess.run(['node', str(Path(__file__).resolve().parents[1] / 'generate-dialogue-worlds.mjs'),
                        '--collection', str(collection)], check=True)
        report = seal_collection(collection)
        print(json.dumps(report, ensure_ascii=False), flush=True)
        publish_collection(collection, site, working / 'assets')
    print('Full collection published. Temporary downloaded inputs and build files removed.', flush=True)
    return report
