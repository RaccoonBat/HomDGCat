// Relations are resolved from the same source tables as the list and detail pages.
export async function listRecords(store, names) {
    const lists = await Promise.all(names.map(name => store.optionalTable(name)));
    const rows = lists.flatMap((list, index) => (Array.isArray(list) ? list.map((row,key)=>[key,row]) : Object.entries(list)).map(([key,row]) => row&&typeof row==='object'?{...row,_sourceKey:key,_table:names[index]}:{ID:key,Value:row,_table:names[index]}));
    const wanted = new Set(names);
    if (wanted.has('RogueBuff') || wanted.has('RogueTournBuff') || wanted.has('RogueTournFormula')) {
        const buffs = await store.table('MazeBuff');
        const byKey = new Map(buffs.map(row => [row.ID+':'+(row.Lv || 1), row]));
        for (const row of rows) if (row.MazeBuffID) {
            const buff = byKey.get(row.MazeBuffID+':'+(row.MazeBuffLevel || 1));
            if (buff) Object.assign(row, {Name:buff.BuffName, Desc:buff.BuffDesc, ParamList:buff.ParamList});
        }
    }
    if ([...wanted].some(name=>/Miracle$/.test(name))) {
        const [display, tournDisplay, effects, runtimeEffects, tournRuntime] = await Promise.all(['RogueMiracleDisplay','RogueTournMiracleDisplay','RogueMiracleEffectDisplay','RogueMiracleEffect','RogueTournMiracle'].map(name=>store.table(name)));
        const titles = new Map(display.map(row=>[row.MiracleDisplayID,row]));
        const tournTitles = new Map(tournDisplay.map(row=>[row.MiracleDisplayID,row]));
        const descriptions = new Map(effects.map(row=>[row.MiracleEffectDisplayID,row]));
        const runtimeDescriptions = new Map(runtimeEffects.map(row=>[row.MiracleEffectID,row]));
        for (const row of rows) if (row.MiracleID || row.MiracleHandbookID || row.HandbookMiracleID) {
            const tourn=row._table.startsWith('RogueTourn');
            const title=(tourn?tournTitles:titles).get(row.MiracleDisplayID) || titles.get(row.MiracleDisplayID);
            const variant=row.MiracleEffectID!==undefined?row:tournRuntime.find(item=>item.HandbookMiracleID===row.HandbookMiracleID);
            const effect=row.MiracleEffectDisplayID!==undefined?descriptions.get(row.MiracleEffectDisplayID):runtimeDescriptions.get(variant?.MiracleEffectID);
            if(title)Object.assign(row,{Name:title.MiracleName, Background:title.MiracleBGDesc,IconPath:title.MiracleIconPath});
            if(effect)Object.assign(row,{Desc:effect.MiracleDesc,ParamList:effect.DescParamList || effect.ParamList});
        }
    }
    if(wanted.has('RogueMagicScepter') || wanted.has('RogueMagicUnit')){
        const [scepters,units,buffs]=await Promise.all(['RogueMagicScepterDisplay','RogueMagicUnitDisplay','MazeBuff'].map(name=>store.table(name)));
        for(const row of rows){
            if(row.ScepterID){const display=scepters.find(item=>item.ScepterID===row.ScepterID);const buff=buffs.find(item=>item.ID===row.StaffMazeBuffID&&item.Lv===(row.ScepterLevel||1));if(display)Object.assign(row,{Name:display.ScepterName,Background:display.ScepterBGDesc,Desc:display.ScepterTriggerDesc,IconPath:display.ScepterIconPath});if(buff)Object.assign(row,{SkillDesc:buff.BuffDesc,ParamList:buff.ParamList});}
            if(row.MagicUnitID){const display=units.find(item=>item.MagicUnitID===row.MagicUnitID);const buff=buffs.find(item=>item.ID===row.MagicUnitMazeBuffID&&item.Lv===(row.MagicUnitLevel||1));if(buff)Object.assign(row,{Name:buff.BuffName,Desc:row.MagicUnitDesc || buff.BuffDesc,ParamList:buff.ParamList});if(display)row.IconPath=display.MagicUnitIcon;}
        }
    }
    return rows;
}

export async function relatedRecords(store, category, row) {
    const result={};
    const mazeTable={chaos:'ChallengeMazeConfig',fiction:'ChallengeStoryMazeConfig',shadow:'ChallengeBossMazeConfig'}[category];
    if (mazeTable) {
        result.floors=(await store.table(mazeTable)).filter(item=>item.GroupID===row.GroupID);
        const schedules={chaos:'ScheduleDataChallengeMaze',fiction:'ScheduleDataChallengeStory',shadow:'ScheduleDataChallengeBoss'};
        result.schedule=(await store.optionalTable(schedules[category])).filter(item=>item.ID===row.ScheduleDataID || item.ScheduleDataID===row.ScheduleDataID);
    }
    if(category==='arbitration') {
        result.floors=(await store.table('ChallengePeakConfig')).filter(item=>(row.PreLevelIDList || []).includes(item.ID));
        result.floors.push(...(await store.table('ChallengePeakBossConfig')).filter(item=>item.ID===row.BossLevelID));
    }
    if (result.floors || category==='stages') {
        const stageRows=await store.table('StageConfig');
        const stageMap=new Map(stageRows.map(item=>[item.StageID,item]));
        const eventIds=new Set((result.floors || []).flatMap(item=>[...(item.EventIDList1 || []),...(item.EventIDList2 || []),...(item.EventIDList || []),...(item.HardEventIDList || [])]));
        const events=(await store.table('PlaneEvent')).filter(item=>eventIds.has(item.EventID));
        const ids=new Set(events.map(item=>item.StageID));
        result.floors=(result.floors || []).map(floor=>({...floor,stages:[...new Set(events.filter(event=>[...(floor.EventIDList1 || []),...(floor.EventIDList2 || []),...(floor.EventIDList || []),...(floor.HardEventIDList || [])].includes(event.EventID)).map(event=>event.StageID))]}));
        if(category==='stages')ids.add(row.StageID);
        result.stages=[...ids].map(id=>stageMap.get(id)).filter(Boolean);
        const [infiniteGroups,infiniteWaves,infiniteMonsters]=await Promise.all(['StageInfiniteGroup','StageInfiniteWaveConfig','StageInfiniteMonsterGroup'].map(name=>store.table(name)));
        result.stages=result.stages.map(stage=>{
            const ids=(stage.StageConfigData || []).map(item=>Object.values(item)).filter(values=>values.includes('_StageInfiniteGroup')).map(values=>Number(values.find(value=>value!=='_StageInfiniteGroup')));
            const groups=infiniteGroups.filter(item=>ids.includes(item.WaveGroupID));
            const waves=infiniteWaves.filter(item=>groups.some(group=>group.WaveIDList.includes(item.InfiniteWaveID)));
            const extras=waves.flatMap(wave=>wave.MonsterGroupIDList.map(id=>infiniteMonsters.find(item=>item.InfiniteMonsterGroupID===id)).filter(Boolean));
            return {...stage,InfiniteMonsterGroups:extras};
        });
        const monsters=await store.table('MonsterConfig'), templates=await store.table('MonsterTemplateConfig');
        const monsterIds=new Set(result.stages.flatMap(item=>[...(item.MonsterList || []).flatMap(wave=>Object.values(wave)),...(item.InfiniteMonsterGroups || []).flatMap(group=>group.MonsterList)]));
        result.monsters=monsters.filter(item=>monsterIds.has(item.MonsterID));
        const templateIds=new Set(result.monsters.map(item=>item.MonsterTemplateID));
        result.templates=templates.filter(item=>templateIds.has(item.MonsterTemplateID));
        result.hard=(await store.table('HardLevelGroup')).filter(item=>result.stages.some(stage=>stage.Level===item.Level));
        result.elite=await store.table('EliteGroup');
        result.buffs=(await store.table('MazeBuff')).filter(item=>[row.MazeBuffID,...(result.floors || []).flatMap(floor=>[floor.MazeBuffID,...(floor.BuffList || [])])].includes(item.ID));
    }
    if(category==='tutorials')result.pages=(await store.table('TutorialGuideData')).filter(item=>(row.TutorialGuideIDList || []).includes(item.ID));
    if(category==='achievements')result.quest=(await store.optionalTable('QuestData')).filter(item=>item.QuestID===row.QuestID);
    if(category==='events') {
        result.schedules=(await store.optionalTable('ScheduleDataActivityPanel')).filter(item=>item.PanelID===row.PanelID);
        if(row.UnlockNPCProgressIDList) {
            const ids=new Set(row.UnlockNPCProgressIDList.flatMap(item=>Object.values(item)));
            const npcs=(await Promise.all(['RogueNPC','RogueTournNPC'].map(name=>store.optionalTable(name)))).flat().filter(item=>ids.has(item.RogueNPCID ?? item.NPCID));
            result.dialogue=await dialogueGraph(store,npcs.map(item=>item.NPCJsonPath).filter(Boolean));
        }
    }
    return result;
}

export async function dialogueGraph(store, startingPaths) {
    const index=await store.json('common/logic/index.json');
    const seen=new Set(), paths=[...startingPaths], sentenceIds=[], options=[];
    function walk(value) {
        if(Array.isArray(value))value.forEach(walk);
        else if(value&&typeof value==='object')for(const [key,item] of Object.entries(value)){
            if(key==='TalkSentenceID'&&typeof item==='number')sentenceIds.push(item);
            if(key==='OptionID'&&typeof item==='number')options.push(item);
            walk(item);
        }
        else if(typeof value==='string'&&value.endsWith('.json')&&index[value]&&!seen.has(value))paths.push(value);
    }
    while(paths.length){const path=paths.shift();if(seen.has(path)||!index[path])continue;seen.add(path);walk(await store.logic(path));}
    const talks=new Map((await store.table('TalkSentenceConfig')).map(item=>[item.TalkSentenceID,item]));
    const optionRows=(await store.table('RogueDialogueOption')).filter(item=>options.includes(item.OptionID));
    const display=new Map((await store.table('RogueDialogueOptionDisplay')).map(item=>[item.OptionDisplayID,item]));
    return {sentences:[...new Set(sentenceIds)].map(id=>talks.get(id)).filter(Boolean),options:optionRows.map(item=>({...item,...display.get(item.OptionDisplayID)}))};
}
