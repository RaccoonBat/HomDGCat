"""Check the whole collection before any live directory is replaced."""
import json
from pathlib import Path

from .build import write_json
from .source import LANGUAGES, REVISION, digest


def seal_collection(root):
    root = Path(root)
    files = []
    for file in sorted(root.rglob('*.json')):
        relative = file.relative_to(root).as_posix()
        if relative in ('manifest.json', 'metadata/files.json', 'metadata/validation.json'):
            continue
        files.append({'path': relative, 'bytes': file.stat().st_size, 'sha256': digest(file)})
    info = write_json(root, 'metadata/files.json', files)
    manifest = json.loads((root / 'manifest.json').read_text(encoding='utf-8'))
    manifest['integrity'] = info
    write_json(root, 'manifest.json', manifest)
    return validate_collection(root)


def validate_collection(root):
    root = Path(root).resolve()
    def read(relative):
        file = (root / relative).resolve()
        if not file.is_relative_to(root):
            raise ValueError('Path escapes collection: ' + relative)
        return json.loads(file.read_text(encoding='utf-8'))
    manifest = read('manifest.json')
    if manifest['schema'] != 2 or manifest['revision'] != REVISION or set(manifest['languages']) != set(LANGUAGES):
        raise ValueError('Unexpected schema, revision or languages')
    integrity = manifest['integrity']
    if digest(root / integrity['path']) != integrity['sha256']:
        raise ValueError('Integrity index changed')
    files = read(integrity['path'])
    for info in files:
        target = (root / info['path']).resolve()
        if not target.is_relative_to(root) or target.stat().st_size != info['bytes'] or digest(target) != info['sha256']:
            raise ValueError('Corrupt collection file: ' + info['path'])
    for name, info in manifest['tables'].items():
        rows = read(info['path'])
        if len(rows) != info['rows'] or digest(root / info['path']) != info['sha256']:
            raise ValueError('Table count or hash mismatch: ' + name)
    text_counts = {}
    for language, info in manifest['texts'].items():
        seen = set()
        for part in info['files']:
            values = read(part['path'])
            if seen.intersection(values):
                raise ValueError('Duplicated text bodies in ' + language)
            seen.update(values)
        if len(seen) != info['keys']:
            raise ValueError('Missing text in ' + language)
        text_counts[language] = len(seen)
    index = read(manifest['logic']['index'])
    if len(index) != manifest['logic']['files']:
        raise ValueError('Missing game logic index entries')
    actual = {}
    for part in sorted(set(index.values())):
        for source in read(part):
            if source in actual:
                raise ValueError('Duplicated logic source: ' + source)
            actual[source] = part
    if actual != index:
        raise ValueError('Logic bundle index does not match content')
    inventory = read(manifest['source']['inventory'])
    expected_tables = {Path(item['path']).stem for item in inventory if item['path'].startswith('ExcelOutput/') and item['path'].endswith('.json')}
    expected_logic = {item['path'] for item in inventory if item['path'].startswith(('Config/', 'Stages/', 'Story/')) and item['path'].endswith('.json')}
    if expected_tables != set(manifest['tables']) or expected_logic != set(index):
        raise ValueError('Source files were omitted during compilation')
    report = {'version': manifest['version'], 'revision': manifest['revision'], 'files': len(files),
              'tables': len(manifest['tables']), 'logicFiles': len(index), 'texts': text_counts,
              'missingMonsterImages': len(manifest.get('assets', {}).get('missingMonsters', []))}
    return report
