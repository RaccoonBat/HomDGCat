"""Map versioned entity assets, reusing matching named local sprites."""
import concurrent.futures
import hashlib
import json
import time
import urllib.request
from pathlib import Path

from .build import write_json
from .source import ASSET_REPOSITORY, ASSET_REVISION


def sync_assets(collection, site, asset_tree, indexes, output, log=print):
    collection, site, output = Path(collection), Path(site), Path(output)
    manifest = json.loads((collection / 'manifest.json').read_text(encoding='utf-8'))
    tree = json.loads(Path(asset_tree).read_text(encoding='utf-8'))
    if tree.get('truncated'):
        raise ValueError('Asset directory is truncated')
    remote = {item['path']: item for item in tree['tree'] if item['type'] == 'blob'}
    existing = {str(file.relative_to(site)).replace('\\', '/').lower(): '/' + file.relative_to(site).as_posix()
                for file in (site / 'images').rglob('*') if file.is_file()}
    result = {'repository': ASSET_REPOSITORY, 'revision': ASSET_REVISION,
              'entities': {}, 'skills': {}, 'paths': {}, 'missing': [], 'files': {}}
    needed = {}

    def use(resource, original=''):
        if original.startswith('SpriteOutput/'):
            key = ('images/' + original[len('SpriteOutput/'):]).lower()
            if key in existing:
                result['paths'][original] = existing[key]
                return existing[key]
        if not resource or resource not in remote:
            if resource:
                result['missing'].append(resource)
            return ''
        relative = 'images/resources/' + resource
        needed[resource] = relative
        url = '/' + relative
        result['paths'][resource] = url
        if original:
            result['paths'][original] = url
        return url

    def table(name):
        return json.loads((collection / manifest['tables'][name]['path']).read_text(encoding='utf-8'))

    specs = {
        'characters': ('characters', ['AvatarConfig', 'AvatarConfigLD'], 'AvatarID', 'DefaultAvatarHeadIconPath', 'AvatarCutinFrontImgPath'),
        'light-cones': ('light_cones', ['EquipmentConfig'], 'EquipmentID', 'ThumbnailPath', 'ImagePath'),
        'relics': ('relic_sets', ['RelicSetConfig'], 'SetID', 'SetIconPath', ''),
        'items': ('items', ['ItemConfig', 'ItemConfigAvatar', 'ItemConfigEquipment', 'ItemConfigRelic'], 'ID', 'ItemIconPath', 'ItemFigureIconPath'),
    }
    for category, (index_name, tables, id_field, icon_field, portrait_field) in specs.items():
        index = json.loads((Path(indexes) / ('asset-index-' + index_name + '.json')).read_text(encoding='utf-8'))
        entities = result['entities'].setdefault(category, {})
        for name in tables:
            if name not in manifest['tables']:
                continue
            for row in table(name):
                identifier = str(row[id_field])
                entry = index.get(identifier, {})
                entities[identifier] = {'icon': use(entry.get('icon', ''), row.get(icon_field, '')),
                    'portrait': use(entry.get('portrait', ''), row.get(portrait_field, '')) if portrait_field else ''}
    skills = {}
    for name in ('character_skills', 'character_ranks'):
        skills.update(json.loads((Path(indexes) / ('asset-index-' + name + '.json')).read_text(encoding='utf-8')))
    for name in ('AvatarSkillConfig', 'AvatarSkillConfigLD', 'AvatarServantSkillConfig', 'AvatarRankConfig', 'AvatarRankConfigLD'):
        if name not in manifest['tables']:
            continue
        for row in table(name):
            identifier = str(row.get('SkillID', row.get('RankID')))
            if identifier in result['skills']:
                continue
            icon = skills.get(identifier, {}).get('icon', '')
            result['skills'][identifier] = use(icon, row.get('SkillIcon', row.get('IconPath', '')))
    for resource in remote:
        if resource.startswith(('icon/path/', 'icon/element/')):
            use(resource)
    # Map every existing monster sprite without replacing missing new images by a placeholder.
    missing_monsters = []
    monsters = result['entities'].setdefault('monsters', {})
    for row in table('MonsterTemplateConfig'):
        for field in ('IconPath', 'ImagePath', 'RoundIconPath', 'ManikinImagePath'):
            original = row.get(field, '')
            if original:
                use('', original)
        monsters[str(row['MonsterTemplateID'])] = {
            'icon': result['paths'].get(row.get('IconPath'), ''),
            'portrait': result['paths'].get(row.get('ImagePath'), '')}
        if not any(monsters[str(row['MonsterTemplateID'])].values()):
            missing_monsters.append(row['MonsterTemplateID'])
    result['missingMonsters'] = missing_monsters
    # Reuse existing tutorial, universe and UI sprites by their original source path.
    def find_paths(value):
        if isinstance(value, dict):
            for child in value.values():
                find_paths(child)
        elif isinstance(value, list):
            for child in value:
                find_paths(child)
        elif isinstance(value, str) and value.startswith('SpriteOutput/'):
            use('', value)
    for name in manifest['tables']:
        find_paths(table(name))

    def fetch(pair):
        resource, relative = pair
        destination = output / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        expected = remote[resource]['sha']
        def valid(data):
            return hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest() == expected
        if destination.exists() and valid(destination.read_bytes()):
            return resource, {'path': relative, 'gitBlob': expected, 'bytes': destination.stat().st_size}
        error = None
        for attempt in range(3):
            try:
                url = f'https://raw.githubusercontent.com/{ASSET_REPOSITORY}/{ASSET_REVISION}/{resource}'
                with urllib.request.urlopen(url, timeout=45) as response:
                    data = response.read()
                if not valid(data):
                    raise ValueError('Asset hash mismatch: ' + resource)
                partial = destination.with_suffix('.part')
                partial.write_bytes(data)
                partial.replace(destination)
                return resource, {'path': relative, 'gitBlob': expected, 'bytes': len(data)}
            except Exception as reason:
                error = reason
                time.sleep(attempt + 1)
        raise RuntimeError(f'Failed asset: {resource}: {error}')

    log(f'  Fetching {len(needed)} missing sprites', flush=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        for count, (resource, info) in enumerate(pool.map(fetch, sorted(needed.items())), 1):
            result['files'][resource] = info
            if count % 25 == 0:
                log(f'  Assets {count}/{len(needed)}', flush=True)
    write_json(collection, 'metadata/assets.json', result)
    return result
