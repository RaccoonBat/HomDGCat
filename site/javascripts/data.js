// One access point for shared datasets; failed requests can be retried.
(function () {
    'use strict';
    const pending = new Map();
    window.WikiData = {
        json(url) {
            const key = new URL(url, location.href).href;
            if (!pending.has(key)) {
                pending.set(key, fetch(key).then(response => {
                    if (!response.ok) throw new Error(key + ': HTTP ' + response.status);
                    return response.json();
                }).catch(error => { pending.delete(key); throw error; }));
            }
            return pending.get(key);
        },
        async updates() {
            const index = await this.json('/data/updates.json');
            const [text, ch, en] = await Promise.all([
                this.json('/TextMap/SR.json'), this.json('/TextMap/SR_Talk_CH.json'),
                this.json('/TextMap/SR_Talk_EN.json')
            ]);
            const textVersions = new Map(), talkVersions = new Map();
            for (const run of index.runs) {
                for (const id of run.textmap_hashes || []) if (!textVersions.has(id)) textVersions.set(id, run.version);
                for (const id of run.talk_ids || []) if (!talkVersions.has(id)) talkVersions.set(id, run.version);
            }
            const enById = new Map(en.map(item => [item.I, item]));
            return {
                ...index,
                textmap: text.filter(item => textVersions.has(item.H)).map(item => ({...item, v: textVersions.get(item.H)})),
                talk: ch.filter(item => talkVersions.has(item.I)).map(item => {
                    const en = enById.get(item.I);
                    if (!en) throw new Error('Missing English dialogue I' + item.I);
                    return {I: item.I, SCH: item.S, TCH: item.T, SEN: en.S, TEN: en.T, v: talkVersions.get(item.I)};
                })
            };
        }
    };
})();
