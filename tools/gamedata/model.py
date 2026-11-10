"""Lossless browser-safe values and explicit source precedence."""
import re
import json

MAX_SAFE_INTEGER = 2**53 - 1


def normalize(value, field=None):
    if isinstance(value, dict):
        return {key: normalize(item, key) for key, item in value.items()}
    if isinstance(value, list):
        return [normalize(item, field) for item in value]
    if isinstance(value, int) and not isinstance(value, bool):
        return str(value) if field == 'Hash' or abs(value) > MAX_SAFE_INTEGER else value
    return value


def classify_table(name):
    groups = (
        ('characters', ('Avatar', 'MultiplePathAvatar', 'Servant')),
        ('light-cones', ('Equipment',)),
        ('relics', ('Relic',)),
        ('monsters', ('Monster', 'EliteGroup', 'HardLevel')),
        ('items', ('Item', 'Material', 'Reward', 'Drop')),
        ('stages', ('Stage', 'Challenge', 'Maze', 'Mapping', 'World', 'Plane')),
        ('achievements', ('Achievement',)),
        ('simulated-universe', ('Rogue', 'Roguelike', 'ChessRogue')),
        ('tutorials', ('Tutorial',)),
        ('stories', ('Talk', 'Dialogue', 'Dialog', 'Mission', 'Story', 'Stroy', 'Message', 'Contact')),
        ('readables', ('Book', 'Localbook', 'Readable')),
        ('events', ('Activity', 'Event', 'Gacha')),
    )
    for category, prefixes in groups:
        if name.startswith(prefixes):
            return category
    return 'system'


def _early(version):
    match = re.fullmatch(r'(\d+)\.(\d+)(?:\.\d+)?', str(version))
    return bool(match and (int(match[1]), int(match[2])) < (2, 6))


def merge_sources(remote, local, id_field):
    """A legacy record can only fill an absent, verifiably pre-2.6 entity."""
    result = list(remote)
    seen = {str(row[id_field]) for row in remote}
    audit = {'legacy_ids': [], 'rejected_ids': [], 'remote_ids': list(seen)}
    for row in local:
        identifier = row[id_field]
        if str(identifier) in seen:
            continue
        if not _early(row.get('_version')):
            audit['rejected_ids'].append(identifier)
            continue
        result.append({key: value for key, value in row.items() if key != '_version'})
        audit['legacy_ids'].append(identifier)
        seen.add(str(identifier))
    return result, audit


def entity_aliases(collection, manifest):
    characters = {'2212':{'id':1212,'enhanced':True},'2205':{'id':1205,'enhanced':True},
                  '2005':{'id':1005,'enhanced':True},'2006':{'id':1006,'enhanced':True},'12210':{'id':1221}}
    peak = json.loads((collection / manifest['tables']['ChallengePeakGroupConfig']['path']).read_text(encoding='utf-8'))
    arbitration = {}
    for row in peak:
        match = re.search(r'BtnChallengePeak_(\d+)\.png$', row.get('ThemePosterTabPicPath',''))
        if match:
            arbitration[match[1]] = {'id':row['ID']}
    return {'characters':characters,'arbitration':arbitration}
