"""Derive introduction versions from pinned remote release snapshots, without copying values."""
import json
import re
import subprocess
import time
from collections import defaultdict
from pathlib import Path

from .build import write_json
from .source import REPOSITORY, REVISION

TABLE_IDS = {
    'AvatarConfig':'AvatarID','AvatarConfigLD':'AvatarID','EquipmentConfig':'EquipmentID',
    'RelicSetConfig':'SetID','MonsterTemplateConfig':'MonsterTemplateID','MonsterConfig':'MonsterID',
    'ItemConfig':'ID','ItemConfigAvatar':'ID','ItemConfigEquipment':'ID','ItemConfigRelic':'ID','ItemPlayerCard':'ID',
    'AchievementData':'AchievementID','TutorialGuideGroup':'GroupID','LoadingDesc':'ID',
    'BookSeriesConfig':'BookSeriesID','LocalbookConfig':'BookID','StageConfig':'StageID',
    'ChallengeGroupConfig':'GroupID','ChallengeStoryGroupConfig':'GroupID','ChallengeBossGroupConfig':'GroupID','ChallengePeakGroupConfig':'ID',
    'RogueBuff':'MazeBuffID','RogueMiracle':'MiracleID','RogueTournBuff':'MazeBuffID','RogueTournMiracle':'MiracleID',
    'RogueTournFormula':'FormulaID','RogueMagicScepter':'ScepterID','RogueMagicUnit':'MagicUnitID','RogueMagicMiracle':'MiracleID',
    'RogueHandbookMiracle':'MiracleHandbookID','RogueTournHandbookMiracle':'HandbookMiracleID',
    'ActivityPanel':'PanelID','RogueHandBookEvent':'EventHandbookID','RogueTournHandBookEvent':'EventHandbookID',
    'GachaBasicInfo':'GachaID','ExtraEffectConfig':'ExtraEffectID','AvatarStatusConfig':'StatusID','MonsterStatusConfig':'StatusID',
    'TalkSentenceConfig':'TalkSentenceID',
}
EARLY = '2.6及以前'


def git(repo, *args, data=None):
    # 历史拉取使用 HTTP/1.1，并在连接重置时重试；本地 Git 错误不重试。
    fetching = args[0] == 'fetch'
    command = ['git', '-c', 'http.version=HTTP/1.1', '-C', str(repo), *args]
    for attempt in range(3 if fetching else 1):
        try:
            return subprocess.check_output(command, input=data)
        except subprocess.CalledProcessError:
            if not fetching or attempt == 2:
                raise
            print(f'  Retrying history fetch ({attempt + 1}/2)', flush=True)
            time.sleep(attempt + 1)


def plan_history(repo):
    repo = Path(repo)
    if not (repo / '.git').exists():
        repo.mkdir(parents=True, exist_ok=True)
        subprocess.run(['git','init',str(repo)], check=True, stdout=subprocess.DEVNULL)
        git(repo,'remote','add','origin',f'https://github.com/{REPOSITORY}.git')
        git(repo,'config','remote.origin.promisor','true')
        git(repo,'config','remote.origin.partialclonefilter','blob:none')
        git(repo,'fetch','--filter=blob:none','--no-tags','origin',REVISION)
    releases = {}
    for line in git(repo,'log','--format=%H %s',REVISION).decode().splitlines():
        sha, message = line.split(' ',1)
        match = re.search(r'OSPRODWin(\d+\.\d+)\.',message)
        if match:
            releases.setdefault(match[1],sha)
    paths = ['ExcelOutput/'+name+'.json' for name in TABLE_IDS] + ['TextMap/TextMapCHS.json','TextMap/TextMapMainCHS.json']
    plan = []
    for version in sorted(releases,key=lambda value:tuple(map(int,value.split('.')))):
        files = {}
        selected=paths+(['TextMap/TextMapEN.json'] if tuple(map(int,version.split('.')))<=(3,1) else [])
        for line in git(repo,'ls-tree',releases[version],*selected).decode().splitlines():
            info, name = line.split('\t',1)
            files[name] = info.split()[2]
        plan.append({'version':version,'revision':releases[version],'files':files})
    if not plan or plan[-1]['revision'] != REVISION:
        raise ValueError('Release chronology does not reach the pinned current revision')
    return plan


def build_version_index(collection, history, early=None):
    collection, history = Path(collection), Path(history)
    manifest = json.loads((collection/'manifest.json').read_text(encoding='utf-8'))
    plan = plan_history(history)
    oids = sorted({oid for release in plan for oid in release['files'].values()})
    # Batch wants let Git delta-compress related versions instead of transferring
    # the entire text corpus independently for every release.
    git(history,'fetch','--no-tags','--no-write-fetch-head','--filter=blob:none','--stdin','origin',data=('\n'.join(oids)+'\n').encode())
    current_keys = set()
    for language in manifest['texts'].values():
        for part in language['files']:
            current_keys.update(json.loads((collection/part['path']).read_text(encoding='utf-8')))
    current_ids = {}
    for table, field in TABLE_IDS.items():
        if table in manifest['tables']:
            rows = json.loads((collection/manifest['tables'][table]['path']).read_text(encoding='utf-8'))
            current_ids[table] = {str(row[field]) for row in rows if isinstance(row,dict) and field in row}
    text_versions, table_versions = {}, {name:{} for name in current_ids}
    process = subprocess.Popen(['git','-C',str(history),'cat-file','--batch'],stdin=subprocess.PIPE,stdout=subprocess.PIPE)
    def read(oid):
        process.stdin.write((oid+'\n').encode());process.stdin.flush()
        header = process.stdout.readline().split()
        if len(header)!=3 or header[1]!=b'blob':
            raise ValueError('Missing historical source blob: '+oid)
        raw = process.stdout.read(int(header[2]));process.stdout.read(1)
        return json.loads(raw)
    bridge=defaultdict(set)
    migration=next((release for release in plan if release['version']=='3.1'),None)
    older=[release for release in plan if tuple(map(int,release['version'].split('.')))<(3,1)]
    def hashes(value,path=()):
        result={}
        if isinstance(value,dict):
            if 'Hash' in value:result[path]=str(value['Hash'])
            for key,child in value.items():result.update(hashes(child,path+(key,)))
        elif isinstance(value,list):
            for index,child in enumerate(value):result.update(hashes(child,path+(index,)))
        return result
    try:
        if migration:
            for table,field in TABLE_IDS.items():
                name='ExcelOutput/'+table+'.json'
                if name not in migration['files']:continue
                reference={str(row[field]):hashes(row) for row in read(migration['files'][name]) if isinstance(row,dict) and field in row}
                for release in older:
                    if name not in release['files']:continue
                    for row in read(release['files'][name]):
                        if not isinstance(row,dict) or field not in row:continue
                        target=reference.get(str(row[field]),{})
                        for path,old_hash in hashes(row).items():
                            new_hash=target.get(path)
                            if new_hash in current_keys:bridge[old_hash].add(new_hash)
            chinese=read(migration['files']['TextMap/TextMapCHS.json'])
            english=read(migration['files']['TextMap/TextMapEN.json'])
            pairs=defaultdict(list)
            for key in current_keys.intersection(chinese):pairs[(chinese[key],english.get(key,''))].append(key)
            for release in older:
                chinese=read(release['files']['TextMap/TextMapCHS.json'])
                english=read(release['files']['TextMap/TextMapEN.json'])
                for old_hash,text in chinese.items():
                    candidates=pairs.get((text,english.get(old_hash,'')),[])
                    if len(candidates)==1:bridge[old_hash].add(candidates[0])
        for release in plan:
            version = EARLY if release['version']==plan[0]['version'] else release['version']
            for name, oid in release['files'].items():
                rows = read(oid)
                if name.startswith('TextMap/'):
                    for key in current_keys.intersection(rows):
                        text_versions.setdefault(key,version)
                    if release in older:
                        for old_hash in rows:
                            for key in bridge.get(old_hash,()):text_versions.setdefault(key,version)
                else:
                    table = Path(name).stem
                    if table not in current_ids:
                        continue
                    field = TABLE_IDS[table]
                    for row in rows:
                        if not isinstance(row,dict) or field not in row:
                            continue
                        if table in ('AvatarConfig','AvatarConfigLD','EquipmentConfig') and not row.get('Release',False):
                            continue
                        identifier = str(row[field])
                        if identifier in current_ids[table]:
                            table_versions[table].setdefault(identifier,version)
            print('  Indexed release '+release['version'],flush=True)
    finally:
        process.stdin.close();process.stdout.close();process.wait()
    early = early or {}
    for table, values in early.items():
        if table not in table_versions:
            continue
        for identifier, version in values.items():
            match = re.fullmatch(r'(\d+)\.(\d+)',version)
            if match and tuple(map(int,match.groups())) < (2,6) and table_versions[table].get(identifier)==EARLY:
                table_versions[table][identifier] = version
    def groups(values):
        result = defaultdict(list)
        for identifier, version in values.items():
            result[version].append(identifier)
        return dict(result)
    result = {'schema':1,'revision':REVISION,'basis':'first recorded released entity / text key in remote production snapshots',
              'earliestSnapshot':plan[0]['version'],'earlyLabel':EARLY,
              'hashMigration':{'version':'3.1','bridgedOldIds':len(bridge),'basis':'stable record/field references and unique bilingual content'},
              'sources':[{key:value for key,value in row.items() if key!='files'} for row in plan],
              'earlyEntityMetadata':early,'texts':groups(text_versions),
              'tables':{table:{'idField':TABLE_IDS[table],'versions':groups(values)} for table,values in table_versions.items()}}
    write_json(collection,'metadata/versions.json',result)
    return result
