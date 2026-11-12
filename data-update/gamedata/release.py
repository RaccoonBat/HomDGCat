"""Derive home page additions from the preceding release, never from ID order."""
import json
import urllib.request

from .build import write_json
from .source import REPOSITORY

BASELINE = '74a7b96fba32f00cf495a5c00b0311bd02207aaf'


def release_metadata(collection):
    manifest = json.loads((collection / 'manifest.json').read_text(encoding='utf-8'))
    current, previous = {}, {}
    for name in ('AvatarConfig', 'AvatarConfigLD', 'EquipmentConfig'):
        current[name] = json.loads((collection / manifest['tables'][name]['path']).read_text(encoding='utf-8'))
        request = urllib.request.Request(f'https://raw.githubusercontent.com/{REPOSITORY}/{BASELINE}/ExcelOutput/{name}.json', headers={'User-Agent':'HomDGCat-full-data/1.0'})
        with urllib.request.urlopen(request, timeout=60) as response:
            previous[name] = json.load(response)
    old_characters = {row['AvatarID'] for name in ('AvatarConfig', 'AvatarConfigLD') for row in previous[name] if row.get('Release')}
    old_equipment = {row['EquipmentID'] for row in previous['EquipmentConfig'] if row.get('Release')}
    release = {'version': manifest['version'], 'revision': manifest['revision'], 'sourceDate': '2026-11-11',
               'baselineVersion': '4.6.0', 'baselineRevision': BASELINE,
               'newCharacters': [row['AvatarID'] for name in ('AvatarConfig', 'AvatarConfigLD') for row in current[name] if row.get('Release') and row['AvatarID'] not in old_characters],
               'newLightCones': [row['EquipmentID'] for row in current['EquipmentConfig'] if row.get('Release') and row['EquipmentID'] not in old_equipment]}
    write_json(collection, 'metadata/release.json', release)
    return release
