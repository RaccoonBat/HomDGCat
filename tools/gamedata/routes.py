"""Keep existing URLs and add source entity URLs without copying page templates."""
import copy
import json
from pathlib import Path

from .build import write_json

CATEGORIES = {'char':'characters','anniversary':'characters','ach':'achievements','arbitration':'arbitration',
              'banner':'banner','chaos':'chaos','du':'simulated-universe','effect':'effect','event':'events',
              'fiction':'fiction','item':'items','monster':'monsters','readable':'readables','shadow':'shadow',
              'stage':'stages','tut':'tutorials'}


def build_routes(site, collection, output):
    site, collection, output = Path(site), Path(collection), Path(output)
    catalog = json.loads((site / 'pages/routes.json').read_text(encoding='utf-8'))
    catalog = copy.deepcopy(catalog)
    manifest = json.loads((collection / 'manifest.json').read_text(encoding='utf-8'))
    for key in [key for key,page in catalog['pages'].items() if page.get('component')=='text-updates']:
        del catalog['pages'][key]
    catalog['routes']['/sr/textupd']={'redirect':'/sr/search'}
    profile_by_name = {}
    for key, page in catalog['pages'].items():
        name = key.rsplit('-', 1)[0]
        profile_by_name[name] = key
        page['versioned'] = True
        page['scripts']=[src.replace('/data/yunli.js','/javascripts/data/yunli-scores.js') for src in page['scripts']]
        page['scripts']=[src for src in page['scripts'] if src not in ('/javascripts/ver.js','/javascripts/didyouknow.js','/data/New.js')]
        if name == 'index':
            page['homeData']=True
        if name in CATEGORIES or name in ('search','linecount'):
            page['scripts'] = ['/plugins/jquery.js','/plugins/thin.js','/javascripts/core/language.js','/javascripts/core/site-text.js']
            page['inlineStyles'] = []
            page['styles'] = ['/stylesheets/thin.css','/stylesheets/style.css','/stylesheets/game.css']
            page['component'] = 'game-text' if name in ('search','linecount') else 'game-data'
            page['game'] = {'statistics': True} if name == 'linecount' else {'category': CATEGORIES.get(name,'characters'), 'characterTabs': name in ('char','anniversary')}
    def add(path, profile, field, identifier):
        catalog['routes'][path] = {'page':profile_by_name[profile], 'params':{'LANG':'',field:str(identifier),'IMGPRE':'/'}}
    specs = [('char','AvatarConfig','AvatarID','AVID'),('char','AvatarConfigLD','AvatarID','AVID'),
             ('char','EquipmentConfig','EquipmentID','AVID'),('char','RelicSetConfig','SetID','AVID'),
             ('monster','MonsterTemplateConfig','MonsterTemplateID','MONSTERID'),('monster','MonsterConfig','MonsterID','MONSTERID'),
             ('chaos','ChallengeGroupConfig','GroupID','CID'),('fiction','ChallengeStoryGroupConfig','GroupID','CID'),
             ('shadow','ChallengeBossGroupConfig','GroupID','CID'),('arbitration','ChallengePeakGroupConfig','ID','CID')]
    for profile, table, field, parameter in specs:
        for row in json.loads((collection / manifest['tables'][table]['path']).read_text(encoding='utf-8')):
            add('/sr/'+profile+'/'+str(row[field]),profile,parameter,row[field])
    for path, category in [('characters','characters'),('light-cones','light-cones'),('relics','relics'),('stories','stories')]:
        key='collection-'+path
        page=copy.deepcopy(catalog['pages'][profile_by_name['char']])
        page['game']={'category':category,'characterTabs':category in ('characters','light-cones','relics')}
        if category == 'stories':
            page['component']='game-text'
            page['game']={}
        catalog['pages'][key]=page
        catalog['routes']['/sr/'+path]={'page':key,'params':{'LANG':'','AVID':'','IMGPRE':'/'}}
    for route, options, params in [
        ('/sr/boss',{'category':'monsters'},{'MONSTERID':''}),
        ('/sr/change',{'category':'characters','characterTabs':True,'releaseOnly':True},{'AVID':''}),
        ('/sr/anniversary',{'category':'characters','characterTabs':True},{'AVID':'1221'})]:
        key='collection-'+route.rsplit('/',1)[-1]
        page=copy.deepcopy(catalog['pages'][profile_by_name['char']])
        page['game']=options
        catalog['pages'][key]=page
        catalog['routes'][route]={'page':key,'params':{'LANG':'','IMGPRE':'/',**params}}
    catalog['routes']['/sr/future']=copy.deepcopy(catalog['routes']['/sr/change'])
    for route in ('/sr/du','/sr/du31','/sr/readable','/sr/search'):
        if route in catalog['routes']:
            catalog['routes'][route]['params']['AVID']=''
    write_json(output, 'routes.json', catalog)
    return catalog
