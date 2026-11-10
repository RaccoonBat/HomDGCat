import {gameData} from '/javascripts/data/collection.js?v=4.6-search-20261110-final';
const PATHS={Knight:'Preservation',Rogue:'Hunt',Mage:'Erudition',Warlock:'Nihility',Warrior:'Destruction',Shaman:'Harmony',Priest:'Abundance',Memory:'Remembrance',Elation:'Elation'};
export async function initHomepageData(){
    const manifest=await gameData.manifest(),release=await gameData.json('metadata/release.json');
    const [base,collaboration,equipment]=await Promise.all(['AvatarConfig','AvatarConfigLD','EquipmentConfig'].map(name=>gameData.table(name)));
    const wanted=[...base,...collaboration].filter(row=>release.newCharacters.includes(row.AvatarID)).map(row=>({category:'characters',row,id:row.AvatarID,name:row.AvatarName}));
    wanted.push(...equipment.filter(row=>release.newLightCones.includes(row.EquipmentID)).map(row=>({category:'light-cones',row,id:row.EquipmentID,name:row.EquipmentName})));
    const localized={};
    for(const language of manifest.languages)localized[language]=await gameData.localize(wanted.map(item=>item.name),language);
    window.NEW_SR=wanted.map((item,index)=>{
        const raw=item.row,element={Physical:'Phys',Thunder:'Elec'}[raw.DamageType] || raw.DamageType;
        const path=PATHS[raw.AvatarBaseType] || raw.AvatarBaseType;
        return {Name:Object.fromEntries(manifest.languages.map(language=>[language,localized[language][index]])),
            Rarity:Number(raw.Rarity.match(/\d+$/)?.[0] || 0),Link:'/sr/char/'+item.id,
            Icon:manifest.assets.entities[item.category][item.id]?.icon || '',Elem:element,Type:path,
            ElemIcon:element?'/images/Element/'+element+'.png':'',
            PathIcon:manifest.assets.paths?.['icon/path/'+path+'.png'] || '/images/Paths/'+path+'.png'};
    });
    const chinese=window.lang3==='CH';
    window.didyouknow_sr=[chinese?'当前数据快照：'+manifest.version:'Current data snapshot: '+manifest.version,
        chinese?'数据源更新于 '+release.sourceDate:'Source updated on '+release.sourceDate];
    window.didyouknow_=()=>{const target=document.querySelector('.didyouknow');if(target)target.textContent=window.didyouknow_sr[(window._wikiTip=(window._wikiTip || 0)+1)%window.didyouknow_sr.length];};
    window.SR_Times=[];
    window.SR_Stamp=0;
    const names=window.NEW_SR.filter(item=>item.Elem).map(item=>item.Name[window.lang3] || item.Name.EN);
    document.querySelector('meta[name="description"]').content='Honkai: Star Rail '+manifest.version+' · '+names.join(', ');
    window.jQuery(()=>{const table=document.querySelector('.ctable');if(table){const row=table.insertRow();const cell=row.insertCell();cell.colSpan=3;cell.textContent=chinese?'当前 4.6 快照未提供后续版本日程。':'The 4.6 snapshot does not provide future version dates.';}});
}
