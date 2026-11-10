"""Shared page catalog, safe static routing and dependency-free static export."""
import argparse
import json
import re
import shutil
from functools import lru_cache
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote


class _Tag(HTMLParser):
    def handle_starttag(self, tag, attrs):
        self.attrs = dict(attrs)


def _attrs(tag):
    parser = _Tag()
    parser.feed(tag)
    return parser.attrs


def normalize_route(value):
    route = value.split('?')[0].split('#')[0]
    route = '/' + route.lstrip('/')
    route = re.sub(r'/index\.html$', '', route).rstrip('/')
    return route or '/index'


def extract_page(html):
    scripts = []
    def script(match):
        attrs = _attrs('<script '+match[1]+'>')
        src = attrs.get('src')
        if src and not any(x in src for x in ('cdn-cgi', 'cloudflareinsights')):
            scripts.append(src)
        if not src and match[2].strip():
            raise ValueError('Inline script needs explicit migration')
        return ''
    html = re.sub(r'<script\b([^>]*)>([\s\S]*?)</script>', script, html, flags=re.I)
    styles = []
    for tag in re.findall(r'<link\b[^>]*>', html, re.I):
        attrs = _attrs(tag)
        if attrs.get('rel') == 'stylesheet':
            styles.append(attrs['href'])
    inline_styles = re.findall(r'<style\b[^>]*>([\s\S]*?)</style>', html, re.I)
    title = re.search(r'<title>([\s\S]*?)</title>', html, re.I)
    description = ''
    for tag in re.findall(r'<meta\b[^>]*>', html, re.I):
        attrs = _attrs(tag)
        if attrs.get('name') == 'description':
            description = attrs.get('content','')
    body_tag = re.search(r'<body\b[^>]*>',html,re.I)
    body_attrs = _attrs(body_tag[0]) if body_tag else {}
    html = re.sub(r'<head\b[^>]*>[\s\S]*?</head>', '', html, flags=re.I)
    params, inputs = {}, []
    def hidden(match):
        attrs = _attrs(match[0])
        if attrs.get('type') != 'hidden' or not attrs.get('id'):
            return match[0]
        params[attrs['id']] = attrs.pop('value', '') or ''
        inputs.append(attrs)
        return ''
    html = re.sub(r'<input\b[^>]*>', hidden, html, flags=re.I)
    html = re.sub(r'<!doctype[^>]*>|</?(?:html|body)\b[^>]*>', '', html, flags=re.I)
    markup = re.sub(r'>\s+<','><', html).strip()
    return {'params':params,'template':{
        'title':title[1] if title else 'HomDGCat Wiki',
        'description':description,'styles':styles,'inlineStyles':inline_styles,
        'scripts':scripts,'inputs':inputs,'bodyAttrs':body_attrs,'markup':markup}}


@lru_cache(maxsize=8)
def _catalog(filename, mtime, size):
    return json.loads(Path(filename).read_text(encoding='utf-8'))


def load_catalog(site):
    file = Path(site)/'pages/routes.json'
    if not file.exists():
        return {'routes':{},'pages':{}}
    stat=file.stat()
    return _catalog(str(file.resolve()),stat.st_mtime_ns,stat.st_size)


def find_route(catalog, value):
    route=normalize_route(value)
    routes=catalog['routes']
    if route in routes:
        return routes[route]
    decoded=unquote(route)
    for key, entry in routes.items():
        if unquote(key)==decoded:
            return entry
    return None


def resolve_site_path(site, *candidates):
    site=Path(site)
    base=site.resolve()
    for candidate in candidates:
        candidate=candidate.split('?')[0].split('#')[0]
        for value in (unquote(candidate),candidate):
            target=site/value.lstrip('/')
            try:
                target.resolve().relative_to(base)
            except (ValueError,OSError):
                continue
            if target.is_file():
                return target
            index = target/'index.html'
            if index.is_file():
                try:
                    index.resolve().relative_to(base)
                except (ValueError, OSError):
                    continue
                return index
        if '..' in unquote(candidate).split('/'):
            continue
        if find_route(load_catalog(site),candidate):
            shell=site/'pages/index.html'
            if shell.is_file():
                return shell
    return None


def export_site(site, output):
    site,output=Path(site).resolve(),Path(output).resolve()
    if output==site or output.is_relative_to(site) or site.is_relative_to(output):
        raise ValueError('Export must be separate from the source site')
    if output.exists() and any(output.iterdir()):
        raise ValueError('Export directory must be empty; existing output is never deleted automatically')
    shutil.copytree(site,output,dirs_exist_ok=True)
    for name in ('CNAME', '.nojekyll'):
        metadata = site.parent / name
        if metadata.is_file():
            shutil.copy2(metadata, output / name)
    shell=(site/'pages/index.html').read_bytes()
    for route in load_catalog(site)['routes']:
        for alias in {route,unquote(route)}:
            # Original paths such as 1218%0A exist as literal encoded names.
            # Their decoded control characters cannot be Windows filenames.
            if any(ord(char) < 32 or char in '<>:"\\|?*' for char in alias):
                continue
            dest=output/alias.lstrip('/')/'index.html'
            try:
                dest.resolve().relative_to(output)
            except ValueError:
                raise ValueError('Invalid route: '+route)
            dest.parent.mkdir(parents=True,exist_ok=True)
            dest.write_bytes(shell)
    (output/'index.html').write_bytes(shell)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command',choices=['export'])
    parser.add_argument('--output',default='dist')
    args=parser.parse_args()
    export_site(Path(__file__).resolve().parents[1]/'site',Path(args.output))
    print('Static site exported to '+str(Path(args.output).resolve()))


if __name__=='__main__':
    main()
