"""Compile complete remote tables and four-language text into a single collection."""
import hashlib
import json
from collections import defaultdict
from pathlib import Path

from .model import classify_table, normalize
from .source import LANGUAGES, REPOSITORY, REVISION, VERSION, Snapshot, digest
from .textkeys import resolve_named_references

CORE_TABLES = {
    'characters': ['AvatarConfig', 'AvatarConfigLD', 'AvatarConfigEnhanced'],
    'light-cones': ['EquipmentConfig'],
    'relics': ['RelicSetConfig'],
    'monsters': ['MonsterTemplateConfig', 'MonsterConfig'],
    'items': ['ItemConfig', 'ItemConfigAvatar', 'ItemConfigEquipment', 'ItemConfigRelic'],
    'achievements': ['AchievementData'],
    'tutorials': ['TutorialData'],
    'readables': ['BookSeriesConfig', 'LocalbookConfig'],
    'events': ['ActivityConfig', 'GachaBasicInfo'],
    'stages': ['ChallengeGroupConfig', 'ChallengeStoryGroupConfig', 'ChallengeBossGroupConfig', 'ChallengePeakGroupConfig'],
    'simulated-universe': ['RogueBuff', 'RogueMiracle', 'RogueEvent'],
}


def write_json(root, relative, data):
    target = Path(root) / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    content = json.dumps(data, ensure_ascii=False, separators=(',', ':'), allow_nan=False).encode('utf-8')
    target.write_bytes(content)
    return {'path': str(relative).replace('\\', '/'), 'bytes': len(content),
            'sha256': hashlib.sha256(content).hexdigest()}


def collect_hashes(value, result):
    if isinstance(value, dict):
        if 'Hash' in value:
            result.add(str(value['Hash']))
        for item in value.values():
            collect_hashes(item, result)
    elif isinstance(value, list):
        for item in value:
            collect_hashes(item, result)


def build_collection(archive, output, log=print):
    output = Path(output)
    if output.exists() and any(output.iterdir()):
        raise ValueError('Build output must be empty; live data is never overwritten by build')
    output.mkdir(parents=True, exist_ok=True)
    manifest = {'schema': 2, 'version': VERSION, 'repository': REPOSITORY, 'revision': REVISION, 'textShards': 1024,
                'languages': list(LANGUAGES), 'tables': {}, 'categories': {}, 'texts': {},
                'sourcePrecedence': ['remote-current', 'remote-history', 'legacy-local-before-2.6']}
    catalog_hashes = set()
    with Snapshot(archive) as snapshot:
        inventory = snapshot.inventory()
        known_text_keys = set()
        for codes in LANGUAGES.values():
            for code in codes:
                known_text_keys.update(snapshot.read_json(f'TextMap/TextMap{code}.json'))
            main_code = 'KR' if codes[0].startswith('KR') else codes[0]
            if f'TextMap/TextMapMain{main_code}.json' in snapshot.files:
                known_text_keys.update(snapshot.read_json(f'TextMap/TextMapMain{main_code}.json'))
        alias_cache = {}
        write_json(output, 'metadata/source-files.json', inventory)
        for name in sorted(snapshot.files):
            if not name.startswith('ExcelOutput/') or not name.endswith('.json'):
                continue
            table = Path(name).stem
            category = classify_table(table)
            rows = resolve_named_references(normalize(snapshot.read_json(name)), known_text_keys, alias_cache)
            relative = f'common/{category}/{table}.json'
            info = write_json(output, relative, rows)
            info.update({'category': category, 'source': name, 'rows': len(rows) if isinstance(rows, (dict, list)) else 1})
            manifest['tables'][table] = info
            manifest['categories'].setdefault(category, []).append(table)
            if table in {name for tables in CORE_TABLES.values() for name in tables}:
                # Collect only top-level localized summary fields; skills remain lazy.
                records = rows if isinstance(rows, list) else rows.values() if isinstance(rows, dict) else []
                for row in records:
                    if isinstance(row, dict):
                        for field, value in row.items():
                            if any(word in field.lower() for word in ('name', 'introduction')):
                                collect_hashes(value, catalog_hashes)
            if len(manifest['tables']) % 200 == 0:
                log(f'  Compiled {len(manifest["tables"])} tables', flush=True)
        for lang, codes in LANGUAGES.items():
            text = {}
            source_files = [f'TextMap/TextMap{code}.json' for code in codes]
            main_code = 'KR' if lang == 'KR' else codes[0]
            main = f'TextMap/TextMapMain{main_code}.json'
            if main in snapshot.files:
                source_files.append(main)
            for name in source_files:
                for key, value in snapshot.read_json(name).items():
                    if key in text and text[key] != value:
                        raise ValueError(f'Conflicting {lang} text key {key} in {name}')
                    text[key] = value
            catalog, buckets = {}, defaultdict(dict)
            for key, value in text.items():
                if key in catalog_hashes:
                    catalog[key] = value
                else:
                    buckets[f'{int(key) % 1024:03x}'][key] = value
            files = [write_json(output, f'{lang}/texts/catalog.json', catalog)]
            for bucket, values in sorted(buckets.items()):
                files.append(write_json(output, f'{lang}/texts/{bucket}.json', values))
            manifest['texts'][lang] = {'keys': len(text), 'catalogKeys': len(catalog), 'sources': source_files, 'files': files}
            for category, tables in manifest['categories'].items():
                write_json(output, f'{lang}/{category}/index.json', {
                    'language': lang, 'version': VERSION,
                    'primaryTables': [name for name in CORE_TABLES.get(category, []) if name in manifest['tables']],
                    'tables': tables, 'textCatalog': f'/{lang}/texts/catalog.json'})
            log(f'  {lang}: {len(text):,} text keys, {len(catalog):,} list labels', flush=True)
        # Config/Stages/Story are bundled to preserve every field without creating
        # tens of thousands of tiny duplicated runtime files.
        bundles, bundle, size, number, parts = {}, {}, 0, 0, []
        for name in sorted(snapshot.files):
            if not name.startswith(('Config/', 'Stages/', 'Story/')) or not name.endswith('.json'):
                continue
            data = resolve_named_references(normalize(snapshot.read_json(name)), known_text_keys, alias_cache)
            bundle[name] = data
            size += snapshot.files[name].file_size
            bundles[name] = f'common/logic/{number:04d}.json'
            if size >= 4 * 1024 * 1024:
                parts.append(write_json(output, f'common/logic/{number:04d}.json', bundle))
                bundle, size, number = {}, 0, number + 1
                if number % 25 == 0:
                    log(f'  Compiled {len(bundles):,} logic files', flush=True)
        if bundle:
            parts.append(write_json(output, f'common/logic/{number:04d}.json', bundle))
        index_info = write_json(output, 'common/logic/index.json', bundles)
        write_json(output, 'metadata/text-aliases.json', {key: value for key, value in alias_cache.items() if value})
        manifest['logic'] = {'files': len(bundles), 'bundles': len(parts), 'index': index_info['path'], 'parts': [index_info, *parts]}
        manifest['source'] = {'files': len(inventory), 'bytes': sum(item['bytes'] for item in inventory),
                              'archiveSha256': digest(archive), 'inventory': 'metadata/source-files.json'}
    write_json(output, 'manifest.json', manifest)
    return manifest
