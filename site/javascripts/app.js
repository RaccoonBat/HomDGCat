import { createApp, h, Fragment, createStaticVNode, onMounted } from '/plugins/vue.runtime.esm-browser.prod.js';
import {gameData} from '/javascripts/data/collection.js?v=4.6-search-20261110-final';

const ASSET_VERSION = '4.6-search-20261110-final';
function assetURL(src) {
    const url = new URL(src, location.href);
    url.searchParams.set('v', ASSET_VERSION);
    return url.pathname + url.search;
}

function routeKey(path) {
    return path.replace(/\/index\.html$/, '').replace(/\/+$/, '') || '/index';
}
function lookup(routes, path) {
    const key = routeKey(path);
    if (routes[key]) return routes[key];
    const decoded = decodeURIComponent(key);
    const alias = Object.keys(routes).find(route => decodeURIComponent(route) === decoded);
    return alias ? routes[alias] : null;
}
function loadScript(src) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = assetURL(src);
        script.onload = resolve;
        script.onerror = () => reject(new Error('无法加载 / Cannot load ' + src));
        document.head.append(script);
    });
}
function loadStyle(href) {
    href = assetURL(href);
    if ([...document.querySelectorAll('link[rel="stylesheet"]')].some(link => link.getAttribute('href') === href)) return Promise.resolve();
    return new Promise(resolve => {
        const link = document.createElement('link');
        link.rel = 'stylesheet'; link.href = href;
        // Preserve existing missing-asset behavior: a missing optional style is not a fatal page error.
        link.onload = link.onerror = resolve;
        document.head.append(link);
    });
}
function showError(error) {
    console.error(error);
    const panel = document.createElement('div');
    panel.className = 'wiki-load-error';
    panel.textContent = '页面加载失败 / Page failed to load: ' + error.message;
    const retry = document.createElement('button');
    retry.textContent = '重试 / Retry'; retry.onclick = () => location.reload();
    panel.append(retry); document.body.append(panel);
}

const SharedPage = {
    props: ['profile', 'params'],
    setup(props) {
        const template = document.createElement('template');
        template.innerHTML = props.profile.markup;
        const count = template.content.childNodes.length;
        onMounted(async () => {
            let held = false;
            try {
                await loadScript('/javascripts/core/site-ui.js');
                if (props.profile.versioned) {
                    const metadata = await gameData.manifest();
                    window.WIKI_GAME_SCHEMA = metadata.schema;
                    window.VER_SR = metadata.version.replace(/\.0$/, '');
                    window.SR_DATES = {};
                }
                for (const src of props.profile.scripts) {
                    await loadScript(src);
                    if (src.includes('/jquery.js')) { window.jQuery.holdReady(true); held = true; }
                }
                if (props.profile.homeData) {
                    const {initHomepageData} = await import('/javascripts/data/homepage.js?v=4.6-search-20261110-final');
                    await initHomepageData();
                }
                if (props.profile.component === 'game-data') {
                    const {mountGamePage} = await import('/javascripts/pages/entity-browser.js?v=4.6-search-20261110-final');
                    mountGamePage({...props.profile.game, entityId:props.params.AVID || props.params.MONSTERID || props.params.CID || ''});
                }
                if (props.profile.component === 'game-text') {
                    const {mountGameText} = await import('/javascripts/pages/text-search.js?v=4.6-search-20261110-final');
                    mountGameText(props.profile.game || {});
                }
            } catch (error) { showError(error); }
            finally { if (held) window.jQuery.holdReady(false); }
        });
        return () => h(Fragment, null, [
            ...props.profile.inputs.map(attrs => h('input', {...attrs, value: props.params[attrs.id] ?? ''})),
            ...(count ? [createStaticVNode(props.profile.markup, count)] : [])
        ]);
    }
};

async function boot() {
    const response = await fetch('/pages/routes.json', {cache:'no-cache'});
    if (!response.ok) throw new Error('Route catalog: HTTP ' + response.status);
    const catalog = await response.json();
    const route = lookup(catalog.routes, location.pathname);
    if (!route) throw new Error('未知地址 / Unknown URL: ' + location.pathname);
    if(route.redirect){location.replace(route.redirect+location.search+location.hash);return;}
    const profile = catalog.pages[route.page];
    document.title = profile.title;
    document.querySelector('meta[name="description"]').content = profile.description;
    for (const [key, value] of Object.entries(profile.bodyAttrs)) document.body.setAttribute(key, value ?? '');
    for (const css of profile.inlineStyles) {
        const style = document.createElement('style'); style.textContent = css; document.head.append(style);
    }
    document.body.dataset.wikiStyle = profile.styles.map(url => url.split('/').pop().replace(/\.css$/, '')).join(' ');
    document.querySelector('link[href^="/stylesheets/style.css"]')?.remove();
    const styles = [...profile.styles];
    const insertAt = styles.findIndex(url => !['/stylesheets/thin.css', '/stylesheets/style.css'].includes(url));
    styles.splice(insertAt < 0 ? styles.length : insertAt, 0, '/stylesheets/shared.css');
    await Promise.all(styles.map(loadStyle));
    document.body.innerHTML = '';
    createApp(SharedPage, {profile, params: route.params}).mount(document.body);
}
boot().catch(showError);
