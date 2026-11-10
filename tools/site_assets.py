"""Audit or remove images absent from frontend and canonical game-data references."""
import argparse
import json
import re
from pathlib import Path
from urllib.parse import unquote


def image_usage(site):
    site = Path(site).resolve()
    images = site / 'images'
    files = {file.relative_to(images).as_posix().lower(): file
             for file in images.rglob('*') if file.is_file()}
    used = set()
    folders = '|'.join(re.escape(child.name) for child in images.iterdir() if child.is_dir())
    paths = re.compile(r'(?<![\w])(?:/?images/|SpriteOutput/|(?:' + folders + r')/)[^"\'`<>\r\n)]*?\.(?:png|jpe?g|gif|webp|svg|ico|avif)', re.I)
    dynamic = re.compile(r'/images/([\w./-]+/)(?=\$\{|[\'"`]\s*\+)')
    metadata_inventories = {'assets.json','files.json','source-files.json'}
    sources = []
    for directory in ('javascripts','stylesheets','pages','data'):
        for file in (site / directory).rglob('*'):
            if file.suffix.lower() not in ('.js','.css','.html','.json'):
                continue
            if file.parent == site / 'data/metadata' and file.name in metadata_inventories:
                continue
            sources.append(file)
    for file in sources:
        text = file.read_text(encoding='utf-8')
        for match in paths.finditer(text):
            value = unquote(match[0]).replace('\\/', '/')
            if value.lower().startswith('spriteoutput/'):
                value = value[len('SpriteOutput/'):]
            elif value.lower().lstrip('/').startswith('images/'):
                value = value.lstrip('/')[len('images/'):]
            key = value.lower()
            if key in files:
                used.add(key)
        if file.suffix in ('.js','.css','.html'):
            # Template URLs (e.g. /images/Element/${type}.png) use a finite directory.
            # Preserve that directory when the expression cannot be resolved statically.
            for match in dynamic.finditer(text):
                prefix = match[1].lower()
                used.update(key for key in files if key.startswith(prefix))
    unused = [file for key,file in files.items() if key not in used]
    return {'total':len(files),'referenced':len(used),'unused':len(unused),
            'unusedBytes':sum(file.stat().st_size for file in unused)}, unused


def prune_images(site):
    site = Path(site).resolve()
    summary, unused = image_usage(site)
    boundary = (site / 'images').resolve()
    for file in unused:
        if not file.resolve().is_relative_to(boundary):
            raise ValueError('Image path escapes site/images')
        file.unlink()
    for directory in sorted((p for p in boundary.rglob('*') if p.is_dir()), key=lambda p:len(p.parts), reverse=True):
        if not any(directory.iterdir()):
            directory.rmdir()
    return summary


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=('audit','prune'))
    parser.add_argument('--site', type=Path, default=Path(__file__).resolve().parents[1] / 'site')
    args = parser.parse_args()
    result = prune_images(args.site) if args.command == 'prune' else image_usage(args.site)[0]
    print(json.dumps(result))


if __name__ == '__main__':
    main()
