"""游戏数据更新入口：固定版本下载、整理、校验与发布。"""
import argparse
import json
from pathlib import Path

from gamedata.build import build_collection
from gamedata.source import download_snapshot
from gamedata.validate import seal_collection, validate_collection
from gamedata.publish import publish_collection
from gamedata.sync import complete_update


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='command', required=True)
    fetch = commands.add_parser('fetch')
    fetch.add_argument('--archive', required=True)
    build = commands.add_parser('build')
    build.add_argument('--archive', required=True)
    build.add_argument('--output', required=True)
    validate = commands.add_parser('validate')
    validate.add_argument('--collection', required=True)
    seal = commands.add_parser('seal')
    seal.add_argument('--collection', required=True)
    publish = commands.add_parser('publish')
    publish.add_argument('--collection', required=True)
    publish.add_argument('--site', default=str(Path(__file__).resolve().parents[1] / 'site'))
    publish.add_argument('--assets')
    update = commands.add_parser('update')
    update.add_argument('--root', default=str(Path(__file__).resolve().parents[1]))
    update.add_argument('--archive', help='Reuse a previously downloaded, pinned source archive')
    args = parser.parse_args()
    if args.command == 'fetch':
        download_snapshot(args.archive)
    elif args.command == 'build':
        result = build_collection(args.archive, args.output)
        print(json.dumps({'version': result['version'], 'tables': len(result['tables']),
                          'logicFiles': result['logic']['files'], 'logicBundles': result['logic']['bundles'], 'languages': list(result['texts'])}))
    elif args.command in ('validate','seal'):
        print(json.dumps((seal_collection if args.command == 'seal' else validate_collection)(args.collection)))
    elif args.command == 'publish':
        print(json.dumps(publish_collection(args.collection, args.site, args.assets)))
    else:
        complete_update(args.root, args.archive)


if __name__ == '__main__':
    main()
