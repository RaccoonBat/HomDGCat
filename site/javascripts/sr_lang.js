var cookie_lang = "CH"
document.cookie.split(";").forEach(function (c) {
    if ((c.includes('lang=')) && !(c.includes('session'))) {
        cookie_lang = c.substring(c.indexOf('lang=') + 5, c.indexOf('lang=') + 7)
    }
});
var AVAILABLE_LANG = ["CH", "EN", "JP", "KR"]
var url_lang = new URLSearchParams(window.location.search).get('lang')
var param_lang = (url_lang || $('#LANG').val()).toUpperCase()
var store_lang = param_lang
if (!AVAILABLE_LANG.includes(store_lang)) {
    store_lang = "CH"
}
var lang3 = "CH"
if (param_lang) {
    var DATE = new Date()
    document.cookie = 'lang=' + store_lang + ';expires=' + new Date(DATE.getTime() + 8640000000).toUTCString() + ';path=/'
    lang3 = store_lang
} else {
    lang3 = cookie_lang
}
if (!AVAILABLE_LANG.includes(lang3)) lang3 = "CH"
var lang2 = lang3
var lang = lang2
if (lang != "CH" && lang != "EN") lang = "EN"
