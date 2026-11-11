"""Restore verified removed tutorials from the mirror's historical release."""
import json
import urllib.request
import codecs
import re

from .build import write_json, collect_hashes
from .model import normalize
from .source import REPOSITORY

REVISION = '42ee87422dd6888e6c10f22c09909c18d7e029a4'
REMOVED_TUTORIALS = {9333, 9334}


def fetch_table(name):
    request = urllib.request.Request(f'https://raw.githubusercontent.com/{REPOSITORY}/{REVISION}/ExcelOutput/{name}.json', headers={'User-Agent':'HomDGCat-full-data/1.0'})
    with urllib.request.urlopen(request, timeout=90) as response:
        return json.load(response)


def fetch_text(language, wanted):
    code = {'CH':'CHS','EN':'EN','JP':'JP','KR':'KR'}[language]
    request = urllib.request.Request(f'https://raw.githubusercontent.com/{REPOSITORY}/{REVISION}/TextMap/TextMap{code}.json', headers={'User-Agent':'HomDGCat-full-data/1.0'})
    pattern = re.compile(r'(?<!\\)"('+'|'.join(re.escape(key) for key in wanted)+r')"\s*:\s*("(?:[^"\\]|\\.)*")')
    result, buffer, size = {}, '', 0
    decoder = codecs.getincrementaldecoder('utf-8')()
    with urllib.request.urlopen(request, timeout=120) as response:
        while True:
            chunk = response.read(65536)
            if not chunk:
                break
            size += len(chunk)
            buffer += decoder.decode(chunk)
            for match in pattern.finditer(buffer):
                result[match[1]] = json.loads(match[2])
            if wanted <= result.keys():
                break
            buffer = buffer[-65536:]
            if size % (8*1024*1024) == 0:
                print(f'  Historical {language}: scanned {size//1048576} MiB', flush=True)
    return result


def restore_historical(collection, fetch=fetch_table, texts=fetch_text):
    manifest = json.loads((collection / 'manifest.json').read_text(encoding='utf-8'))
    provenance = {'tier':'remote-history','version':'3.8.0','revision':REVISION}
    restored, needed_pages, hashes = {}, set(), set()
    for name, field in [('TutorialGuideGroup','GroupID'),('TutorialGuideData','ID')]:
        info = manifest['tables'][name]
        current = json.loads((collection / info['path']).read_text(encoding='utf-8'))
        existing = {row[field] for row in current}
        wanted = REMOVED_TUTORIALS if name == 'TutorialGuideGroup' else needed_pages
        additions = [normalize(row) for row in fetch(name) if row[field] in wanted and row[field] not in existing]
        selected = [row for row in current if row[field] in wanted and row.get('_provenance') == provenance] + additions
        for row in selected:
            collect_hashes(row, hashes)
            row['_provenance'] = provenance
            needed_pages.update(row.get('TutorialGuideIDList', []))
        info.update(write_json(collection, info['path'], current + additions))
        info['rows'] = len(current) + len(additions)
        restored[name] = [row[field] for row in selected]
    # These historical text references must remain present in every selected language.
    for language, info in manifest['texts'].items():
        known = set()
        for part in info['files']:
            known.update(json.loads((collection / part['path']).read_text(encoding='utf-8')))
        missing = hashes - known
        if missing:
            historical = texts(language, missing)
            absent = missing - historical.keys()
            if absent:
                raise ValueError(f'Historical {language} text missing: {sorted(absent)}; refusing incomplete publication')
            catalog_info = info['files'][0]
            catalog = json.loads((collection / catalog_info['path']).read_text(encoding='utf-8'))
            catalog.update({key:historical[key] for key in missing})
            catalog_info.update(write_json(collection, catalog_info['path'], catalog))
            info['keys'] = len(known | missing)
            info['catalogKeys'] = len(catalog)
        else:
            info['keys'] = len(known)
            info['catalogKeys'] = len(json.loads((collection / info['files'][0]['path']).read_text(encoding='utf-8')))
    manifest['historicalSources'] = [{'repository':REPOSITORY,**provenance,'restored':restored}]
    write_json(collection, 'manifest.json', manifest)
    write_json(collection, 'metadata/historical-sources.json', manifest['historicalSources'])
    return restored
