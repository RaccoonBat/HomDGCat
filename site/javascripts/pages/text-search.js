import {loadVersions,compareEntries,sortVersions} from '/javascripts/data/versions.js?v=4.6-search-20261110-final';
import {createApp,h,ref,shallowRef,computed,onMounted} from '/plugins/vue.runtime.esm-browser.prod.js';
import {gameData} from '/javascripts/data/collection.js?v=4.6-search-20261110-final';
import {safeRichText, plainText} from '/javascripts/core/rich-text.js?v=4.6-search-20261110-final';

export function mountGameText({statistics=false}={}){
    const store=gameData, language=window.lang3 || 'CH', chinese=language==='CH';
    const label=(zh,en)=>chinese?zh:en;
    WikiUI.headerTitle();WikiUI.menuIcons(window.jQuery('#IMGPRE').val() || '/');
    window.jQuery('h3 .lang').html(txt.Home_Lang).hide();
    window.jQuery('body').addClass(window.bg_name || 'bg').on('click','._menu_',()=>popLinks(window.lang));
    const host=document.createElement('div');document.querySelector('container').append(host);
    createApp({setup(){
        const kind=ref(statistics?'count':'text'),query=ref(''),field=ref('text'),loading=ref(false),progress=ref(''),error=ref('');
        const corpus=shallowRef({}),dialogue=shallowRef([]),results=shallowRef([]),page=ref(1),loaded=ref(false),contexts=ref({});
        const pageSize=100,textRows=shallowRef([]),selectedVersion=ref('');
        const availableVersions=computed(()=>sortVersions((kind.value==='talk'?dialogue.value:textRows.value).map(row=>row.version).filter(Boolean)));
        async function load(){
            if(loaded.value)return;loading.value=true;error.value='';
            try{
                const [all,versions]=await Promise.all([store.allTexts(language,(done,total)=>{progress.value=done+' / '+total;}),loadVersions(store)]);
                corpus.value=all;
                textRows.value=Object.entries(all).map(([id,text])=>({id,text,version:versions.text(id)})).sort(compareEntries);
                const raw=await store.table('TalkSentenceConfig');
                dialogue.value=raw.filter(row=>row.TalkSentenceID!==undefined).map(row=>({id:row.TalkSentenceID,speaker:corpus.value[row.TextmapTalkSentenceName?.Hash] || '',text:corpus.value[row.TalkSentenceText?.Hash] || '',version:versions.record({...row,_table:'TalkSentenceConfig'})})).sort((a,b)=>a.id-b.id);
                loaded.value=true;
                if(statistics)countSpeakers();
            }catch(reason){error.value=reason.message;}
            finally{loading.value=false;}
        }
        function countSpeakers(){
            kind.value='count';page.value=1;
            const totals=new Map();
            for(const line of dialogue.value){const name=line.speaker || label('无说话人','Unnamed');const item=totals.get(name)||{id:name,text:name,count:0,characters:0};item.count++;item.characters+=line.text.length;totals.set(name,item);}
            results.value=[...totals.values()].sort((a,b)=>b.count-a.count);
        }
        async function search(nextField='text'){
            field.value=nextField;await load();if(!loaded.value)return;
            const needle=query.value.trim().toLocaleLowerCase();page.value=1;contexts.value={};
            if(kind.value==='text'){
                const aliases=/^\d+$/.test(needle)?await store.json('metadata/legacy-text-ids.json'):{};
                const mapped=aliases[needle],keys=new Set(Array.isArray(mapped)?mapped:mapped?[mapped]:[]);
                results.value=!needle&&!selectedVersion.value?textRows.value:textRows.value.filter(row=>(!selectedVersion.value||row.version===selectedVersion.value)&&(keys.has(row.id)||row.id.includes(needle)||row.text.toLocaleLowerCase().includes(needle)));
            }
            else results.value=dialogue.value.map((row,index)=>({...row,index})).filter(row=>(!selectedVersion.value||row.version===selectedVersion.value)&&(String(row.id).includes(needle)||(nextField==='speaker'?row.speaker:row.text).toLocaleLowerCase().includes(needle))).sort(compareEntries);
        }
        function sentence(row){return h('div',{class:'game-dialogue-line'},[h('small',null,String(row.id)+(row.version?' · '+row.version:'')),row.speaker?h('b',null,' '+plainText(row.speaker)):null,h('div',{class:'game-description',innerHTML:safeRichText(row.text)})]);}
        function adjacent(item,direction){const current=contexts.value[item.id] || {before:0,after:0};const key=direction<0?'before':'after';const count=current[key]+1;const target=item.index+direction*count;if(target<0||target>=dialogue.value.length)return;contexts.value={...contexts.value,[item.id]:{...current,[key]:count}};}
        onMounted(async()=>{await load();if(loaded.value&&!statistics)await search();});
        const pages=computed(()=>Math.max(1,Math.ceil(results.value.length/pageSize)));
        return ()=>h('div',{class:'content game-page'},[
            h('p',{class:'ttl game-title'},label('星穹铁道 文本与剧情搜索','HSR Text & Dialogue Search')+' · '+language),
            h('div',{class:'choice'},[
                h('schedule',{class:kind.value==='text'?'active':'',onClick:()=>{results.value=[];contexts.value={};kind.value='text';search();}},label('搜索文本','Search Text')),
                h('schedule',{class:kind.value==='talk'?'active':'',onClick:()=>{results.value=[];contexts.value={};kind.value='talk';search();}},label('搜索对话','Search Dialogues')),
                h('a',{href:'/sr/readable/'+location.search},[h('schedule',null,label('阅读物搜索','Readables Search'))]),
                h('schedule',{class:kind.value==='count'?'active':'',onClick:countSpeakers},label('台词数统计','Line count'))
            ]),
            h('form',{class:'game-controls',onSubmit:event=>{event.preventDefault();search();}},[
                h('input',{type:'search',value:query.value,placeholder:label('正文、说话人或文本 ID','Text, speaker or text ID'),onInput:event=>query.value=event.target.value}),
                h('button',{type:'submit',disabled:loading.value},label('搜索','Search')),
                h('select',{'aria-label':label('版本','Version'),value:selectedVersion.value,onChange:event=>{selectedVersion.value=event.target.value;search(field.value);}},[h('option',{value:''},label('全部版本 · 最新优先','All versions · Newest first')),...availableVersions.value.map(value=>h('option',{value},value))]),
                kind.value==='talk'?h('button',{type:'button',disabled:loading.value,onClick:()=>search('speaker')},label('搜索说话人','Search Speaker')):null
            ]),
            h('p',{class:'game-scope'},label('搜索范围：','Search scope: ')+(selectedVersion.value||label('全部版本、全部文本','All versions, all texts'))),
            h('p',{class:'hits','aria-live':'polite'},error.value || (loading.value?label('加载中 ','Loading ')+progress.value:label('找到 ','Found ')+results.value.length+label(' 条结果',' results'))),
            error.value?h('button',{onClick:load},label('重试','Retry')):null,
            h('div',{class:'results'},results.value.slice((page.value-1)*pageSize,page.value*pageSize).map(item=>{
                const context=contexts.value[item.id] || {before:0,after:0};
                const isDialogue=kind.value==='talk'&&Number.isInteger(item.index);
                return h('article',{class:'result_single',key:String(item.id)},[
                    isDialogue?h('button',{class:'_up',disabled:item.index-context.before<=0,onClick:()=>adjacent(item,-1)},'↑↑'):null,
                    isDialogue?dialogue.value.slice(Math.max(0,item.index-context.before),item.index).map(sentence):null,
                    kind.value==='count'?h('button',{onClick:()=>{kind.value='talk';query.value=item.text;search('speaker');}},plainText(item.text)+' · '+item.count+label(' 句 · ',' lines · ')+item.characters+label(' 字符',' characters')):sentence(item),
                    isDialogue?dialogue.value.slice(item.index+1,item.index+context.after+1).map(sentence):null,
                    isDialogue?h('button',{class:'_down',disabled:item.index+context.after>=dialogue.value.length-1,onClick:()=>adjacent(item,1)},'↓↓'):null
                ]);
            })),
            h('div',{class:'game-controls'},[h('button',{disabled:page.value<=1,onClick:()=>page.value--},label('上一页','Previous')),h('span',null,page.value+' / '+pages.value),h('button',{disabled:page.value>=pages.value,onClick:()=>page.value++},label('下一页','Next'))])
        ]);
    }}).mount(host);
}
