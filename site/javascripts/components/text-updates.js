import {createApp, h, ref, shallowRef, computed, onMounted} from '/plugins/vue.runtime.esm-browser.prod.js';

export function mountUpdates() {
    const $ = window.jQuery;
    const chinese = window.lang === 'CH';
    document.title = chinese ? '文本增量更新 - HomDGCat Wiki' : 'Text Updates - HomDGCat Wiki';
    document.body.style.fontFamily = chinese ? "'Microsoft YaHei', sans-serif" : "'Segoe UI', sans-serif";
    WikiUI.headerTitle(); WikiUI.menuIcons($('#IMGPRE').val() || '/');
    $('h3 .lang').html(txt.Home_Lang).hide();
    $('body').on('click', '._menu_', () => popLinks(window.lang));
    $('body').addClass(window.bg_name || 'bg');
    const host = document.createElement('div');
    document.querySelector('container').append(host);
    createApp({
        setup() {
            const entries = shallowRef([]), runs = shallowRef([]);
            const query = ref(''), kind = ref('all'), version = ref('all'), page = ref(1);
            const loading = ref(true), error = ref('');
            const pageSize = 100;
            let debounce;
            const label = (zh, en) => chinese ? zh : en;
            const filtered = computed(() => {
                const needle = query.value.toLocaleLowerCase();
                return entries.value.filter(entry => (kind.value === 'all' || entry.kind === kind.value)
                    && (version.value === 'all' || entry.version === version.value)
                    && (!needle || [entry.zh, entry.en, entry.speakerZh, entry.speakerEn].some(text => text.toLocaleLowerCase().includes(needle))));
            });
            const totalPages = computed(() => Math.max(1, Math.ceil(filtered.value.length / pageSize)));
            async function load() {
                loading.value = true; error.value = '';
                try {
                    const payload = await WikiData.updates();
                    runs.value = payload.runs;
                    entries.value = [
                        ...payload.textmap.map(item => ({kind:'textmap', version:item.v || '', zh:item.C || '', en:item.E || '', speakerZh:'', speakerEn:'', key:'H'+item.H})),
                        ...payload.talk.map(item => ({kind:'talk', version:item.v || '', zh:item.TCH || '', en:item.TEN || '', speakerZh:item.SCH || '', speakerEn:item.SEN || '', key:'I'+item.I}))
                    ];
                } catch (reason) { error.value = reason.message; }
                finally { loading.value = false; }
            }
            onMounted(load);
            function change(target, value) { target.value = value; page.value = 1; }
            const bodyText = text => text.replace(/\\n/g, '\n');
            function result(entry) {
                return h('article', {class:'result_single', key:entry.key}, [
                    h('p', {class:'tu-meta'}, [label(entry.kind === 'talk' ? '对话' : '文本', entry.kind === 'talk' ? 'Dialogue' : 'Text'), ' · ', entry.version, ' · ', entry.key]),
                    entry.speakerZh || entry.speakerEn ? h('p', {class:'tu-speaker'}, [entry.speakerZh, entry.speakerEn && entry.speakerEn !== entry.speakerZh ? ' / '+entry.speakerEn : '']) : null,
                    entry.zh ? h('p', {class:'tu-body'}, bodyText(entry.zh)) : null,
                    entry.en ? h('p', {class:'tu-body'}, bodyText(entry.en)) : null
                ]);
            }
            return () => h('div', {class:'content text-updates'}, [
                h('p', {class:'ttl'}, label('星穹铁道 文本增量更新','HSR Text Updates')),
                h('div', {class:'choice'}, [
                    h('a', {href:'/sr/search/'}, [h('schedule', null, label('文本与剧情搜索','Text & Dialogue Search'))]),
                    h('a', {href:'/sr/readable/'}, [h('schedule', null, label('阅读物搜索','Readables Search'))]),
                    h('schedule', {class:'active'}, label('增量更新','Updates'))
                ]),
                h('div', {id:'tu-controls', class:'input_wrap'}, [
                    h('input', {id:'tu-q', type:'search', 'aria-label':label('搜索文本或说话人','Search text or speaker'), placeholder:label('搜索中文、英文或说话人','Search text or speaker'), onInput:event => {clearTimeout(debounce); const value=event.target.value; debounce=setTimeout(()=>change(query,value.trim()),150);}}),
                    h('select', {id:'tu-kind', value:kind.value, 'aria-label':label('类型','Type'), onChange:event=>change(kind,event.target.value)}, [['all','全部类型','All types'],['textmap','文本','Text'],['talk','对话','Dialogue']].map(([value,zh,en])=>h('option',{value},label(zh,en)))),
                    h('select', {id:'tu-version', value:version.value, 'aria-label':label('版本','Version'), onChange:event=>change(version,event.target.value)}, [h('option',{value:'all'},label('全部版本','All versions')), ...[...new Set(runs.value.map(run=>run.version))].reverse().map(value=>h('option',{value},value))])
                ]),
                h('div', {id:'tu-summary', class:'hits', 'aria-live':'polite'}, loading.value ? label('加载中…','Loading…') : error.value ? [error.value, h('button',{onClick:load},label('重试','Retry'))] : [
                    h('p',null,label('共 '+entries.value.filter(e=>e.kind==='textmap').length+' 条文本、'+entries.value.filter(e=>e.kind==='talk').length+' 条对话，来自 '+runs.value.length+' 次更新',entries.value.length+' entries from '+runs.value.length+' updates')),
                    ...runs.value.map(run=>h('p',null,run.version+' · '+(run.recorded_at || '').slice(0,10)+' · '+label('文本 ','Text ')+(run.counts?.textmap || 0)+' / '+label('对话 ','Dialogue ')+(run.counts?.talk || 0)))
                ]),
                h('div', {id:'tu-results', class:'results'}, filtered.value.slice((page.value-1)*pageSize,page.value*pageSize).map(result)),
                !loading.value && !error.value && !filtered.value.length ? h('p',{id:'tu-empty',class:'hits'},label('没有匹配的条目。','No matching entries.')) : null,
                h('div',{id:'tu-pager',class:'input_wrap'},[
                    h('button',{id:'tu-prev',disabled:page.value<=1,onClick:()=>page.value--},label('上一页','Previous')),
                    h('span',{id:'tu-page'},label('第 '+page.value+' / '+totalPages.value+' 页（共 '+filtered.value.length+' 条）',page.value+' / '+totalPages.value+' ('+filtered.value.length+')')),
                    h('button',{id:'tu-next',disabled:page.value>=totalPages.value,onClick:()=>page.value++},label('下一页','Next'))
                ])
            ]);
        }
    }).mount(host);
}
