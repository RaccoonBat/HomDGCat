import {loadVersions,newestFirst,sortVersions} from '/javascripts/data/versions.js?v=4.6-search-20261110-final';
import {safeRichText, plainText} from '/javascripts/core/rich-text.js?v=4.6-search-20261110-final';
import {createApp, h, ref, shallowRef, computed, onMounted} from '/plugins/vue.runtime.esm-browser.prod.js';
import {gameData, valueOf, promotionStats, formatParameters, monsterStats} from '/javascripts/data/collection.js?v=4.6-search-20261110-final';

import {listRecords, relatedRecords} from '/javascripts/data/relations.js?v=4.6-search-20261110-final';
const store = gameData;
const PRIMARY = {
    characters:['AvatarConfig','AvatarConfigLD'], 'light-cones':['EquipmentConfig'], relics:['RelicSetConfig'],
    monsters:['MonsterTemplateConfig'], items:['ItemConfig','ItemConfigAvatar','ItemConfigEquipment','ItemConfigRelic','ItemPlayerCard'],
    achievements:['AchievementData'], tutorials:['TutorialGuideGroup','LoadingDesc'], readables:['BookSeriesConfig'],
    stages:['StageConfig'], chaos:['ChallengeGroupConfig'], fiction:['ChallengeStoryGroupConfig'],
    shadow:['ChallengeBossGroupConfig'], arbitration:['ChallengePeakGroupConfig'],
    'simulated-universe':['RogueBuff','RogueMiracle','RogueTournBuff','RogueTournMiracle','RogueTournFormula','RogueMagicScepter','RogueMagicUnit','RogueMagicMiracle','RogueHandbookMiracle','RogueTournHandbookMiracle'], events:['ActivityPanel','RogueHandBookEvent','RogueTournHandBookEvent'],
    banner:['GachaBasicInfo'], effect:['ExtraEffectConfig','AvatarStatusConfig','MonsterStatusConfig'], stories:['TalkSentenceConfig']
};
const LABELS = {
    characters:['角色','Characters','キャラクター','캐릭터'], 'light-cones':['光锥','Light Cones','光円錐','광추'],
    relics:['遗器','Relics','遺物','유물'], monsters:['怪物','Monsters','敵','적'], items:['物品','Items','アイテム','아이템'],
    achievements:['成就','Achievements','アチーブメント','업적'], tutorials:['教程','Tutorials','チュートリアル','튜토리얼'],
    readables:['阅读物','Readables','書物','읽을거리'], stages:['关卡','Stages','ステージ','스테이지'],
    chaos:['混沌回忆','Memory of Chaos','混沌の記憶','혼돈의 기억'], fiction:['虚构叙事','Pure Fiction','虚構叙事','허구 이야기'],
    shadow:['末日幻影','Apocalyptic Shadow','末日の幻影','종말의 환영'], arbitration:['异相仲裁','Anomaly Arbitration','異相の仲裁','이상 중재'],
    'simulated-universe':['模拟 / 差分宇宙','Simulated / Divergent Universe','模擬宇宙 / 階差宇宙','시뮬레이션 / 차분화 우주'],
    events:['事件与活动','Events','イベント','이벤트'], banner:['跃迁','Warp','跳躍','워프'], effect:['效果','Effects','効果','효과'],
    stories:['剧情对话','Dialogues','会話','대화']
};
const NAME_FIELDS=['AvatarName','EquipmentName','SetName','MonsterName','ItemName','AchievementTitle','TutorialTitle','BookSeries','BookName','SeriesName','GroupName','StageName','PoolName','MessageText','EventTitle','TabName','TitleName','Name','Title','EffectName','ExtraEffectName','MiracleName','BuffName'];
const DESCRIPTION_FIELDS=['MonsterIntroduction','ItemDesc','ItemBGDesc','AchievementDesc','StageDesc','Desc','Description','TutorialDesc','BookSeriesComments','PoolDesc','EffectDesc','ExtraEffectDesc','BuffDesc','MiracleDesc','Background','IntroDesc','TagDesc','DescText','UnlockHintDesc'];
function idOf(row) {return row.AvatarID ?? row.EquipmentID ?? row.SetID ?? row.MonsterTemplateID ?? row.MonsterID ?? row.GroupID ?? row.StageID ?? row.AchievementID ?? row.PanelID ?? row.ExtraEffectID ?? row.StatusID ?? row.EventHandbookID ?? row.MazeBuffID ?? row.ScepterID ?? row.MagicUnitID ?? row.FormulaID ?? row.ID ?? row.Id ?? row.GachaID ?? row.BookSeriesID ?? row.TutorialID ?? row.BuffID ?? row.MiracleHandbookID ?? row.HandbookMiracleID ?? row.MiracleID ?? row.TalkSentenceID ?? row._sourceKey;}
function isNameField(key){return NAME_FIELDS.includes(key)||/Name$|Title$|TitleTextmapID$/.test(key);}
function isDescriptionField(key){return DESCRIPTION_FIELDS.includes(key)||/Desc$|Description$|DescTextmapID$/.test(key);}
function nameOf(row) {for(const key of [...NAME_FIELDS,...Object.keys(row).filter(isNameField)])if(typeof row[key]==='string'&&row[key])return plainText(row[key]);return String(idOf(row) ?? '');}
function descriptionOf(row) {for(const key of [...DESCRIPTION_FIELDS,...Object.keys(row).filter(isDescriptionField)])if(typeof row[key]==='string'&&row[key])return row[key];return '';}
function sourceCategory(category) {return ['chaos','fiction','shadow','arbitration'].includes(category)?'stages':category==='banner'?'events':category==='effect'?'system':category;}
function rich(text,cls='') {return h('div',{class:'game-description '+cls,innerHTML:safeRichText(text)});}

export function mountGamePage({category='characters',entityId='',characterTabs=false,releaseOnly=false}) {
    const language = window.lang3 || 'CH', languageIndex=['CH','EN','JP','KR'].indexOf(language);
    const label=(zh,en,jp=en,kr=en)=>[zh,en,jp,kr][languageIndex] || en;
    const categoryLabel=key=>(LABELS[key] || [key,key,key,key])[languageIndex];
    const $=window.jQuery;
    WikiUI.headerTitle(); WikiUI.menuIcons($('#IMGPRE').val() || '/');
    $('h3 .lang').html(txt.Home_Lang).hide(); $('body').addClass(window.bg_name || 'bg');
    $('body').on('click','._menu_',()=>popLinks(window.lang));
    document.body.style.fontFamily=language==='CH'?"'Microsoft YaHei', sans-serif":"'Segoe UI', sans-serif";
    const host=document.createElement('div'); document.querySelector('container').append(host);
    createApp({setup(){
        const current=ref(category), rows=shallowRef([]), rawRows=shallowRef([]), detail=shallowRef(null), relations=shallowRef({});
        const manifest=shallowRef(null), release=shallowRef(null), query=ref(''), page=ref(1), loading=ref(true), error=ref(''), sourceTable=ref('');
        const detailLoading=ref(false);
        const level=ref(80), promotion=ref(6), skillLevel=ref(10), rank=ref(1), enhanced=ref(false), monsterLevel=ref(95), instanceId=ref('');
        const extraTables=ref(false), inspectData=ref(false), path=ref(''), rarity=ref(''), selectedVersion=ref('');
        let generation=0;
        let chronology;
        const pageSize=60;
        const filtered=computed(()=>rows.value.filter(row=>(!query.value || (nameOf(row)+' '+descriptionOf(row)+' '+idOf(row)+' '+(row._searchContent || '')).toLocaleLowerCase().includes(query.value.toLocaleLowerCase()))
            &&(!path.value||row.AvatarBaseType===path.value)&&(!rarity.value||String(row.Rarity).endsWith(rarity.value))
            &&(!selectedVersion.value||row.ReleaseVersion===selectedVersion.value)));
        const totalPages=computed(()=>Math.max(1,Math.ceil(filtered.value.length/pageSize)));
        function setFilter(target,value){target.value=value;page.value=1;}
        async function selectCategory(next,table='') {
            const token=++generation;current.value=next;sourceTable.value=table;loading.value=true;error.value='';detail.value=null;relations.value={};page.value=1;query.value='';path.value='';rarity.value='';selectedVersion.value='';
            try{
                const meta=await store.manifest();manifest.value=meta;
                chronology ||= await loadVersions(store);
                const names=table?[table]:(PRIMARY[next]||[]).filter(name=>meta.tables[name]);
                document.title=categoryLabel(next)+' - HomDGCat Wiki';
                if (!meta.pathNames?.[language]) {
                    const paths=await store.localize((await store.table('AvatarBaseType')).map(row=>({ID:row.ID,BaseTypeText:row.BaseTypeText})),language);
                    meta.pathNames ||= {};meta.pathNames[language]=Object.fromEntries(paths.map(row=>[row.ID,row.BaseTypeText]));
                }
                const chosen=names.length?names:(meta.categories[sourceCategory(next)]||[]).slice(0,1);
                let records=await listRecords(store,chosen);
                if(releaseOnly){release.value=await store.json('metadata/release.json');const ids=next==='characters'?release.value.newCharacters:next==='light-cones'?release.value.newLightCones:[];records=records.filter(row=>ids.includes(idOf(row)));}
                const summaries=records.map(row=>Object.fromEntries(Object.entries(row).filter(([key])=>isNameField(key)||isDescriptionField(key))));
                const localizedNames=await store.localize(summaries,language);
                const localized=records.map((row,index)=>({...row,...localizedNames[index],ReleaseVersion:chronology.record(row)})).sort((a,b)=>newestFirst(a.ReleaseVersion,b.ReleaseVersion));
                if(token!==generation)return;
                rawRows.value=records;rows.value=localized;
                if(next==='readables')await searchBooks();
            }catch(reason){if(token===generation)error.value=reason.message;}
            finally{if(token===generation)loading.value=false;}
        }
        async function open(row) {
            const token=++generation;detailLoading.value=true;
            const id=idOf(row);detail.value=row;relations.value={};error.value='';enhanced.value=false;
            const original=rawRows.value.find(item=>item._table===row._table&&item._sourceKey===row._sourceKey) || row;
            const sets={characters:['ItemConfigAvatar','AvatarPromotionConfig','AvatarPromotionConfigLD','AvatarSkillConfig','AvatarSkillConfigLD','AvatarSkillTreeConfig','AvatarSkillTreeConfigLD','AvatarRankConfig','AvatarRankConfigLD','AvatarConfigEnhanced','AvatarEnhancedSkill','AvatarEnhancedRank','AvatarEnhancedSkillTree','AvatarServantConfig','AvatarServantSkillConfig','StoryAtlas','VoiceAtlas'],
                'light-cones':['EquipmentPromotionConfig','EquipmentSkillConfig'],relics:['RelicSetSkillConfig','RelicConfig'],
                monsters:['MonsterConfig','MonsterSkillConfig','HardLevelGroup','EliteGroup'], readables:['LocalbookConfig']};
            try{
                const names=(sets[current.value]||[]).filter(name=>manifest.value.tables[name]);
                const all=await Promise.all(names.map(name=>store.table(name)));
                if(!manifest.value.propertyNames?.[language]) {
                    const properties=await store.localize((await store.table('AvatarPropertyConfig')).map(row=>({PropertyType:row.PropertyType,PropertyName:row.PropertyName})),language);
                    manifest.value.propertyNames ||= {};manifest.value.propertyNames[language]=Object.fromEntries(properties.map(row=>[row.PropertyType,row.PropertyName]));
                }
                if(!manifest.value.itemNames?.[language]) {
                    const items=await Promise.all(['ItemConfig','ItemConfigAvatar','ItemConfigEquipment','ItemConfigRelic'].filter(name=>manifest.value.tables[name]).map(name=>store.table(name)));
                    const names=await store.localize(items.flat().map(row=>({ID:row.ID,ItemName:row.ItemName})),language);
                    manifest.value.itemNames ||= {};manifest.value.itemNames[language]=Object.fromEntries(names.map(row=>[row.ID,row.ItemName]));
                }
                const result={};
                const enhancedConfig = current.value==='characters' ? (all[names.indexOf('AvatarConfigEnhanced')] || []).find(item=>item.AvatarID===original.AvatarID) : null;
                const characterSkillIds = new Set([...(original.SkillList || []), ...(enhancedConfig?.SkillList || [])]);
                const servantRows = (all[names.indexOf('AvatarServantConfig')] || []).filter(item=>characterSkillIds.has(item.HPSkill)||characterSkillIds.has(item.SpeedSkill));
                for (const servant of servantRows) for (const id of servant.SkillIDList || []) characterSkillIds.add(id);
                names.forEach((name,index)=>{
                    const data=Array.isArray(all[index])?all[index]:Object.values(all[index]);
                    if(current.value==='characters'){
                        const skillIds=characterSkillIds,rankIds=new Set([...(original.RankIDList||[]),...(enhancedConfig?.RankIDList || [])]);
                        if(name.includes('SkillConfig'))result[name]=data.filter(item=>skillIds.has(item.SkillID));
                        else if(name.includes('RankConfig'))result[name]=data.filter(item=>rankIds.has(item.RankID));
                        else if(name==='AvatarServantConfig')result[name]=servantRows;
                        else if(name==='ItemConfigAvatar')result[name]=data.filter(item=>item.ID===original.AvatarID);
                        else result[name]=data.filter(item=>item.AvatarID===original.AvatarID);
                    } else if(current.value==='light-cones')result[name]=data.filter(item=>item.EquipmentID===id||item.SkillID===original.SkillID);
                    else if(current.value==='relics')result[name]=data.filter(item=>item.SetID===id);
                    else if(current.value==='monsters')result[name]=name==='MonsterConfig'?data.filter(item=>item.MonsterTemplateID===id):data;
                    else if(current.value==='readables')result[name]=data.filter(item=>item.BookSeriesID===id).sort((a,b)=>(a.BookSeriesInsideID||0)-(b.BookSeriesInsideID||0));
                });
                Object.assign(result,await relatedRecords(store,current.value,original));
                const [localized,localizedRow]=await Promise.all([store.localize(result,language),store.localize(original,language)]);
                if(token!==generation)return;
                detail.value=localizedRow;
                relations.value=localized;
                if(current.value==='monsters')instanceId.value=String(relations.value.MonsterConfig?.[0]?.MonsterID || '');
                window.history.replaceState(null,'','#_'+id);
            }catch(reason){if(token===generation)error.value=reason.message;}
            finally{if(token===generation)detailLoading.value=false;}
        }
        function illustration(row,portrait=false){
            const map=manifest.value?.assets?.entities?.[current.value]?.[String(idOf(row))];
            if(map)return portrait?(map.portrait || map.icon):(map.icon || map.portrait);
            const paths=[row.DefaultAvatarHeadIconPath,row.ThumbnailPath,row.SetIconPath,row.IconPath,row.ItemIconPath,...Object.entries(row).filter(([key,value])=>/(IconPath|Icon|ImagePath)$/.test(key)&&typeof value==='string').map(([,value])=>value)].filter(Boolean);
            const mapped=manifest.value?.assets?.paths;
            return paths.map(p=>mapped?.[p]).find(Boolean) || '';
        }
        function controls(){return h('div',{class:'game-controls'},[
            h('input',{type:'search',value:query.value,placeholder:label('搜索名称或 ID','Search name or ID','名前・ID を検索','이름 또는 ID 검색'),onInput:event=>setFilter(query,event.target.value)}),
            current.value==='characters'||current.value==='light-cones'?h('select',{value:path.value,onChange:event=>setFilter(path,event.target.value)},[h('option',{value:''},label('全部命途','All paths')), ...[...new Set(rows.value.map(row=>row.AvatarBaseType).filter(Boolean))].map(value=>h('option',{value},manifest.value?.pathNames?.[language]?.[value] || value))]):null,
            ['characters','light-cones'].includes(current.value)?h('select',{value:rarity.value,onChange:event=>setFilter(rarity,event.target.value)},[h('option',{value:''},label('全部稀有度','All rarities')),...[3,4,5].map(value=>h('option',{value},value+'★'))]):null,
            ['simulated-universe','events'].includes(current.value)?h('select',{value:sourceTable.value,onChange:event=>selectCategory(current.value,event.target.value)},[
                h('option',{value:''},label('全部分类','All categories')),
                ...(PRIMARY[current.value]||[]).map(name=>h('option',{value:name},({RogueHandbookMiracle:label('模拟宇宙 · 奇物图鉴','SU · Curio Index'),RogueTournHandbookMiracle:label('差分宇宙 · 奇物图鉴','DU · Curio Index'),RogueBuff:label('模拟宇宙 · 祝福','SU · Blessings'),RogueMiracle:label('模拟宇宙 · 奇物','SU · Curios'),RogueTournBuff:label('差分宇宙 · 祝福','DU · Blessings'),RogueTournMiracle:label('差分宇宙 · 奇物','DU · Curios'),RogueTournFormula:label('差分宇宙 · 方程','DU · Equations'),RogueMagicScepter:label('不可知域 · 权杖','Unknowable Domain · Scepters'),RogueMagicUnit:label('不可知域 · 组件','Unknowable Domain · Components'),RogueMagicMiracle:label('不可知域 · 奇物','Unknowable Domain · Curios'),ActivityPanel:label('活动','Activities'),RogueHandBookEvent:label('模拟宇宙 · 事件','SU · Events'),RogueTournHandBookEvent:label('差分宇宙 · 事件','DU · Events')})[name] || name))
            ]):null,
            h('select',{'aria-label':label('版本','Version'),value:selectedVersion.value,onChange:event=>setFilter(selectedVersion,event.target.value)},[h('option',{value:''},label('全部版本 · 最新优先','All versions · Newest first')),...sortVersions(rows.value.map(row=>row.ReleaseVersion).filter(Boolean)).map(value=>h('option',{value},value))]),
            h('button',{onClick:()=>extraTables.value=!extraTables.value},label('更多分类','More categories'))
        ]);}
        async function searchBooks(){const token=generation;loading.value=true;error.value='';try{
            const books=await store.localize((await store.table('LocalbookConfig')).map(row=>({BookSeriesID:row.BookSeriesID,BookContent:row.BookContent,BookInsideName:row.BookInsideName,ReleaseVersion:chronology.record({...row,_table:'LocalbookConfig'})})),language);
            const bySeries=new Map(),latest=new Map();for(const book of books){if(!latest.has(book.BookSeriesID)||newestFirst(book.ReleaseVersion,latest.get(book.BookSeriesID))<0)latest.set(book.BookSeriesID,book.ReleaseVersion);}
            for(const book of books)bySeries.set(book.BookSeriesID,(bySeries.get(book.BookSeriesID)||'')+' '+book.BookInsideName+' '+book.BookContent);
            if(token===generation)rows.value=rows.value.map(row=>({...row,_searchContent:bySeries.get(row.BookSeriesID)||'',ReleaseVersion:[row.ReleaseVersion,latest.get(row.BookSeriesID)].filter(Boolean).sort(newestFirst)[0]||''})).sort((a,b)=>newestFirst(a.ReleaseVersion,b.ReleaseVersion));
        }catch(reason){if(token===generation)error.value=reason.message;}finally{if(token===generation)loading.value=false;}}
        function card(row,index){const image=illustration(row);return h('button',{class:'game-card',key:String(idOf(row))+'-'+index,onClick:()=>open(row)},[
            image?h('img',{src:image,loading:'lazy',alt:''}):h('span',{class:'game-no-image'},label('暂无图片','No image')),h('b',null,nameOf(row)),h('small',null,String(idOf(row)??'')),h('small',{class:'game-version'},row.ReleaseVersion || label('版本未标注','Version unknown')),
            row.AvatarBaseType?h('small',null,manifest.value?.pathNames?.[language]?.[row.AvatarBaseType] || row.AvatarBaseType):null]);}
        function numberInput(title,state,min,max){return h('label',null,[title+' ',h('input',{type:'number',min,max,value:state.value,onInput:event=>{const n=Number(event.target.value);state.value=Math.max(min,Math.min(max,Number.isFinite(n)?Math.trunc(n):min));}})]);}
        function skill(row){const params=row.ParamList || row.AbilityParamList || row.Param || [];const icon=manifest.value?.assets?.skills?.[String(row.SkillID || row.RankID)];return h('section',{class:'game-skill'},[
            icon?h('img',{src:icon,alt:'',loading:'lazy'}):null,h('div',{class:'game-skill-body'},[
                h('b',null,plainText(row.SkillName || row.Name || row.PointName || (row.PointID ? label('行迹节点','Trace node') : label('套装效果','Set bonus')))),
                row.SkillTypeDesc || row.SkillTag?h('p',null,plainText([row.SkillTypeDesc,row.SkillTag].filter(Boolean).join(' · '))):null,
                rich(formatParameters(row.SkillDesc || row.Desc || row.PointDesc || '',params)),
                row.Level?h('small',null,'Lv. '+row.Level):null,
                params.length?h('details',null,[h('summary',null,label('全部技能参数','All skill parameters')),h('p',null,params.map((param,index)=>'#'+(index+1)+': '+valueOf(param)).join(' · '))]):null,
                row.StatusAddList?.length?h('ul',null,row.StatusAddList.map(item=>h('li',null,(manifest.value.propertyNames?.[language]?.[item.PropertyType] || item.PropertyType)+' + '+(/Ratio|Chance|Resistance|Probability|CriticalDamage/.test(item.PropertyType)?Number((valueOf(item.Value)*100).toFixed(6))+'%':valueOf(item.Value))))):null,
                row.LevelUpCostList?.length?materials(row.LevelUpCostList):row.MaterialList?.length?materials(row.MaterialList):row.UnlockCost?.length?materials(row.UnlockCost):null
            ])]);}
        function materials(items){return h('p',{class:'game-materials'},items.map(item=>h('span',null,[(manifest.value?.itemNames?.[language]?.[item.ItemID] || String(item.ItemID))+' × '+item.ItemNum])));}
        function statistics(){
            const all=[...(relations.value.AvatarPromotionConfig || []),...(relations.value.AvatarPromotionConfigLD || []),...(relations.value.EquipmentPromotionConfig || [])];
            const row=all.find(item=>(item.Promotion || 0)===promotion.value);
            if(!row)return null;
            const max=row.MaxLevel || 80,lv=Math.min(level.value,max),stats=promotionStats(row,lv);
            for(const key of ['CriticalChance','CriticalDamage','BaseAggro'])if(row[key]!==undefined)stats[key]=valueOf(row[key]);
            const config=enhanced.value?(relations.value.AvatarConfigEnhanced || [])[0]:detail.value;
            if(config?.SPNeed!==undefined)stats.SP=valueOf(config.SPNeed);
            return h('section',{class:'game-statistics'},[
                h('div',{class:'game-controls'},[numberInput(label('等级','Level'),level,1,80),numberInput(label('晋阶','Ascension'),promotion,0,6)]),
                h('table',null,[h('tbody',null,Object.entries(stats).map(([key,value])=>h('tr',null,[h('th',null,key),h('td',null,Number(value.toFixed(6)).toLocaleString())])))]),
                row.PromotionCostList?.length?materials(row.PromotionCostList):null
            ]);
        }
        function monsterStatistics(){
            const template=detail.value,instance=(relations.value.MonsterConfig||[]).find(row=>String(row.MonsterID)===instanceId.value);
            if(!instance)return null;
            const hard=(relations.value.HardLevelGroup || []).find(row=>row.HardLevelGroup===(instance.HardLevelGroup || 0)&&row.Level===monsterLevel.value);
            const elite=(relations.value.EliteGroup || []).find(row=>row.EliteGroup===(instance.EliteGroup || 0));
            if(!hard||!elite)return h('p',null,label('该等级或难度配置缺失','Missing level or difficulty configuration'));
            const values=Object.entries(monsterStats(template,instance,hard,elite)).map(([key,value])=>[key,key==='Stance'?value/3:value]);
            const skills=new Set(instance.SkillList || []);
            return [h('div',{class:'game-controls'},[numberInput(label('怪物等级','Monster level'),monsterLevel,1,Math.max(...(relations.value.HardLevelGroup || []).map(row=>row.Level))),h('select',{value:instanceId.value,onChange:e=>instanceId.value=e.target.value},(relations.value.MonsterConfig||[]).map(row=>h('option',{value:row.MonsterID},String(row.MonsterID))))]),
                h('table',null,[h('tbody',null,values.map(([name,value])=>h('tr',null,[h('th',null,name),h('td',null,Number(value.toFixed(6)).toLocaleString())])))]),
                rich(instance.MonsterIntroduction || ''),
                h('p',null,label('弱点','Weaknesses')+': '+(instance.StanceWeakList||[]).join(' · ')),
                h('p',null,label('属性抗性','Damage resistance')+': '+(instance.DamageTypeResistance || []).map(item=>item.DamageType+' '+Number((valueOf(item.Value)*100).toFixed(4))+'%').join(' · ')),
                h('p',null,label('状态抗性','Status resistance')+': '+(instance.DebuffResist || []).map(item=>item.Key+' '+Number((valueOf(item.Value)*100).toFixed(4))+'%').join(' · ')),
                ...(relations.value.MonsterSkillConfig||[]).filter(row=>skills.has(row.SkillID)).map(skill)];
        }
        function battleStages(){
            const data=relations.value;
            const monsterMap=new Map((data.monsters || []).map(item=>[item.MonsterID,item]));
            function monsterCard(id,stage,eliteOverride){const monster=monsterMap.get(id);const template=(data.templates || []).find(item=>item.MonsterTemplateID===monster?.MonsterTemplateID);
                const hard=(data.hard || []).find(item=>item.Level===stage.Level&&item.HardLevelGroup===(stage.HardLevelGroup || monster?.HardLevelGroup || 0));
                const elite=(data.elite || []).find(item=>item.EliteGroup===(eliteOverride || monster?.EliteGroup || 0));
                const stats=template&&hard&&elite?Object.entries(monsterStats(template,monster,hard,elite)).map(([key,value])=>key+' '+Number((key==='Stance'?value/3:value).toFixed(2)).toLocaleString()).join(' · '):'';
                return h('a',{class:'game-monster-link',href:'/sr/monster/'+id+'?lang='+language},[h('b',null,monster?.MonsterName || id),h('small',null,' '+id),rich(stats),monster?.StanceWeakList?.length?h('p',null,monster.StanceWeakList.join(' · ')):null]);
            }
            function stage(stage){return h('section',{class:'game-battle'},[
                h('b',null,(stage.StageName || stage.StageID)+' · Lv. '+stage.Level),
                ...(stage.MonsterList || []).map((wave,index)=>h('div',{class:'game-wave'},[
                    h('p',null,label('第 ','Wave ')+(index+1)+label(' 波','')),
                    ...Object.values(wave).map(id=>monsterCard(id,stage))
                ])),
                ...(stage.InfiniteMonsterGroups || []).map((group,index)=>h('details',null,[h('summary',null,label('后续怪物组 ','Additional monster group ')+(index+1)),...group.MonsterList.map(id=>monsterCard(id,stage,group.EliteGroup))]))
            ]);}
            return [
                ...(data.schedule || []).map(item=>h('p',null,item.BeginTime+' — '+item.EndTime)),
                ...(data.buffs || []).map(item=>skill({...item,SkillName:item.BuffName,SkillDesc:item.BuffDesc})),
                ...(data.floors || []).map(floor=>h('section',{class:'game-floor'},[
                    h('h2',null,plainText(floor.Name || floor.Title || floor.HardTitle || String(floor.ID))),
                    floor.ChallengeCountDown?h('p',null,label('轮数上限：','Cycle limit: ')+floor.ChallengeCountDown):null,
                    ...(floor.stages || []).map(id=>(data.stages || []).find(item=>item.StageID===id)).filter(Boolean).map(stage)
                ])),
                current.value==='stages'?(data.stages || []).map(stage):null
            ];
        }
        function servants(skills){return (relations.value.AvatarServantConfig || []).map(servant=>{
            function parameter(expression,skillId){if(typeof expression==='string'&&/^#\d+$/.test(expression)){const config=skills.find(row=>row.SkillID===skillId);return valueOf(config?.ParamList?.[Number(expression.slice(1))-1]);}return Number(expression);}
            const hpBase=parameter(servant.HPBase,servant.HPSkill),hpRatio=parameter(servant.HPInherit,servant.HPSkill),speedBase=parameter(servant.SpeedBase,servant.SpeedSkill),speedRatio=parameter(servant.SpeedInherit,servant.SpeedSkill);
            return h('section',{class:'game-book'},[h('h2',null,plainText(servant.ServantName)),
                Number.isFinite(hpBase)&&Number.isFinite(hpRatio)?h('p',null,'HP = '+hpBase+' + '+Number((hpRatio*100).toFixed(4))+'% × '+label('角色生命值','Character HP')):null,
                Number.isFinite(speedBase)&&Number.isFinite(speedRatio)?h('p',null,'SPD = '+speedBase+' + '+Number((speedRatio*100).toFixed(4))+'% × '+label('角色速度','Character SPD')):null]);
        });}
        function fieldContent(row){
            const values=Object.entries(row).filter(([key,value])=>!key.startsWith('_')&&!NAME_FIELDS.includes(key)&&!DESCRIPTION_FIELDS.includes(key)&&value!==undefined);
            return h('table',{class:'game-fields'},[h('tbody',null,values.map(([key,value])=>h('tr',null,[h('th',null,key),h('td',null,plainText(typeof value==='object'?JSON.stringify(value):String(value)))])))]);
        }
        function details(){const row=detail.value,image=illustration(row,true);let blocks=[];
            if(current.value==='characters'){
                const enhancedRow=(relations.value.AvatarConfigEnhanced || [])[0];
                const activeSkills = new Set((enhanced.value && enhancedRow ? enhancedRow.SkillList : row.SkillList) || []);
                for(const servant of relations.value.AvatarServantConfig || []) if(activeSkills.has(servant.HPSkill)||activeSkills.has(servant.SpeedSkill))for(const id of servant.SkillIDList || [])activeSkills.add(id);
                const activeRanks = new Set((enhanced.value && enhancedRow ? enhancedRow.RankIDList : row.RankIDList) || []);
                const skills=[...(relations.value.AvatarSkillConfig||[]),...(relations.value.AvatarSkillConfigLD||[]),...(relations.value.AvatarServantSkillConfig||[])].filter(item=>activeSkills.has(item.SkillID)),ids=[...new Set(skills.map(item=>item.SkillID))];
                const chosen=ids.map(id=>{const levels=skills.filter(row=>row.SkillID===id).sort((a,b)=>(a.Level||1)-(b.Level||1));return levels.filter(row=>(row.Level||1)<=skillLevel.value).at(-1)||levels[0];});
                blocks=[enhancedRow?h('label',{class:'game-enhanced'},[h('input',{type:'checkbox',checked:enhanced.value,onChange:event=>enhanced.value=event.target.checked}),label('强化形态','Enhanced form')]):null,statistics(),rich((relations.value.ItemConfigAvatar||[])[0]?.ItemBGDesc || ''),h('div',{class:'game-controls'},[numberInput(label('技能等级','Skill level'),skillLevel,1,15)]),...servants(chosen),...chosen.map(skill),
                    h('h2',null,label('行迹','Traces')), ...[...(relations.value.AvatarSkillTreeConfig||[]),...(relations.value.AvatarSkillTreeConfigLD||[])].filter(row=>row.PointType!==2 && (row.Level||1)===1 && (enhancedRow ? (enhanced.value ? row.PointID>=10000000 : row.PointID<10000000) : true)).map(skill),
                    h('h2',null,label('星魂','Eidolons')), ...[...(relations.value.AvatarRankConfig||[]),...(relations.value.AvatarRankConfigLD||[])].filter(item=>activeRanks.has(item.RankID)).map(skill),
                    h('h2',null,label('角色故事','Character stories')), ...(relations.value.StoryAtlas||[]).map(item=>rich(item.Story)),
                    h('h2',null,label('语音文本','Voice lines')), ...[...(relations.value.VoiceAtlas||[])].sort((a,b)=>(a.SortID||0)-(b.SortID||0)||(a.VoiceID||0)-(b.VoiceID||0)).map(item=>h('section',{class:'game-voice'},[h('b',{class:'game-voice-title'},plainText(item.VoiceTitle)),h('div',{class:'game-voice-body'},[rich(item.Voice_M || item.Voice_F || ''),item.Voice_F&&item.Voice_M&&item.Voice_F!==item.Voice_M?rich(item.Voice_F):null])]))];
            }else if(current.value==='light-cones'){
                const selected=(relations.value.EquipmentSkillConfig||[]).find(item=>(item.Level||1)===rank.value);
                blocks=[statistics(),h('div',{class:'game-controls'},[numberInput(label('叠影等级','Superimposition'),rank,1,5)]),selected?skill(selected):null];
            }else if(current.value==='relics')blocks=(relations.value.RelicSetSkillConfig||[]).map(item=>h('div',null,[h('h2',null,String(item.RequireNum)+label('件套','-piece set')),skill(item)]));
            else if(current.value==='monsters')blocks=monsterStatistics();
            else if(current.value==='readables')blocks=(relations.value.LocalbookConfig||[]).map(item=>h('section',{class:'game-book'},[h('h2',null,plainText(item.BookInsideName || String(item.BookID))),rich(item.BookContent)]));
            else if(['stages','chaos','fiction','shadow','arbitration'].includes(current.value))blocks=battleStages();
            else if(current.value==='tutorials')blocks=(relations.value.pages || []).map(item=>h('section',{class:'game-book'},[rich(item.DescText),manifest.value.assets.paths?.[item.ImagePath]?h('img',{src:manifest.value.assets.paths[item.ImagePath],alt:''}):null]));
            else if(current.value==='simulated-universe')blocks=[rich(formatParameters(row.Desc || '',row.ParamList || [])),rich(formatParameters(row.SkillDesc || '',row.ParamList || [])),rich(row.Background || '')];
            else if(current.value==='achievements')blocks=[rich(formatParameters(row.AchievementDesc,row.ParamList)),...((relations.value.quest || []).map(fieldContent))];
            else if(current.value==='events')blocks=[...(relations.value.schedules || []).map(item=>h('p',null,item.BeginTime+' — '+item.EndTime)),
                ...(relations.value.dialogue?.sentences || []).map(item=>h('section',{class:'game-book'},[h('b',null,plainText(item.TextmapTalkSentenceName)),rich(item.TalkSentenceText)])),
                ...(relations.value.dialogue?.options || []).map(item=>h('section',{class:'game-skill'},[h('b',null,item.OptionTitle),rich(formatParameters(item.OptionDesc,item.ParamList))]))];
            return h('div',{class:'game-detail'},[
                h('button',{class:'game-back',onClick:()=>{++generation;detailLoading.value=false;detail.value=null;history.replaceState(null,'',location.pathname+location.search);}},label('返回列表','Back to list')),
                h('div',{class:'game-detail-heading'},[image?h('img',{src:image,alt:'',class:'game-portrait'}):null,h('div',null,[h('h1',null,nameOf(row)),h('p',null,String(idOf(row))),rich(descriptionOf(row))])]),
                row._provenance?h('p',{class:'game-provenance'},label('历史资料 · 远程版本 ','Historical data · Remote version ')+row._provenance.version):null,
                detailLoading.value?h('p',{class:'hits'},label('正在加载详情…','Loading details…')):blocks,
                h('details',null,[h('summary',null,label('完整数据','Complete data')),fieldContent(row)])
            ]);
        }
        onMounted(async()=>{
            await selectCategory(category);
            let wanted=String(entityId || location.hash.replace(/^#_?/,''));
            const alias=manifest.value?.entityAliases?.[category]?.[wanted];
            if(alias)wanted=String(alias.id);
            if(wanted&&characterTabs){for(const next of ['characters','light-cones','relics']){if(next!==current.value)await selectCategory(next);const found=rows.value.find(row=>String(idOf(row))===wanted);if(found){await open(found);enhanced.value=Boolean(alias?.enhanced);return;}}await selectCategory(category);}
            else if(wanted){let found=rows.value.find(row=>String(idOf(row))===wanted);if(!found&&current.value==='monsters'){const instances=await store.table('MonsterConfig');const instance=instances.find(row=>String(row.MonsterID)===wanted);found=rows.value.find(row=>row.MonsterTemplateID===instance?.MonsterTemplateID);if(found){await open(found);instanceId.value=wanted;return;}}if(found)await open(found);}
        });
        return ()=>h('div',{class:'content game-page'},[
            h('p',{class:'ttl game-title'},categoryLabel(current.value)+' · '+(releaseOnly?(release.value?.version || ''):label('全部版本','All versions'))),
            releaseOnly&&release.value?h('p',{class:'hits'},label('当前版本新增 · 比较基线 ','New in this release · Baseline ')+release.value.baselineVersion+' · '+release.value.sourceDate):null,
            characterTabs?h('div',{class:'choice'},['characters','light-cones','relics'].map(key=>h('schedule',{class:current.value===key?'active':'',onClick:()=>selectCategory(key)},categoryLabel(key)))):null,
            error.value?h('p',{class:'game-error',role:'alert'},error.value):null,
            loading.value?h('p',{class:'hits'},label('加载中…','Loading…')):detail.value?details():[
                controls(),
                extraTables.value?h('section',{class:'game-table-choices'},Object.entries(manifest.value?.tables||{}).filter(([name,info])=>info.category===sourceCategory(current.value)).map(([name])=>h('button',{onClick:()=>selectCategory(current.value,name)},name))):null,
                h('p',{class:'hits'},label('共 ','Total ')+filtered.value.length),
                h('div',{class:'game-grid'},filtered.value.slice((page.value-1)*pageSize,page.value*pageSize).map(card)),
                h('div',{class:'game-controls'},[h('button',{disabled:page.value<=1,onClick:()=>page.value--},label('上一页','Previous')),h('span',null,page.value+' / '+totalPages.value),h('button',{disabled:page.value>=totalPages.value,onClick:()=>page.value++},label('下一页','Next'))])
            ]
        ]);
    }}).mount(host);
}
