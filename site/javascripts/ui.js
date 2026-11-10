// Shared presentation primitives; retain the original DOM and classes.
window.WikiUI = {
    textLinks(mode) {
        const menu = mode === 'menu';
        return [['/sr/readable', '阅读物搜索', 'Readables Search'], ['/sr/search', '文本+剧情搜索', 'Text+Dialogue Search'], ['/sr/textupd', '文本增量更新', 'Text Updates']].map(([url, zh, en]) => ({
            schedule: {
                a: url,
                t: {span: lang === 'CH' ? zh : en, style: {'margin': 'auto', 'font-weight': 'bold'}, ...(menu ? {class: 'panel'} : {})},
                ...(menu ? {class: 'panel'} : {})
            },
            class: menu ? 'hover-shadow panelw' : 'hover-shadow panel',
            style: {width: 'max-content', ...(menu ? {} : {border: '2px solid #f29e38'})}
        }));
    },
    headerTitle() {
        const $ = window.jQuery;
        $('h3 .title').html(txt.Title[lang] + "<color style='font-size: 26px;'><br>" + txt.game_img[lang] + VER_SR + '</b></color>');
        $('h3 .subtitle').html(txt.Subtitle[lang]);
    },
    menuIcons(imgpre) {
        window.jQuery('h3 .links').render([
            {img: imgpre + 'images/menu.png', class: '_menu_'},
            {img: imgpre + 'images/translate.png', class: '_translate_'}
        ]);
    }
};
