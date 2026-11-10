// Canonical remote-first collection. No legacy globals or guessed numeric fallbacks.
export class GameData {
    constructor(base = '/data') {
        this.base = base.replace(/\/$/, '');
        this.pending = new Map();
    }
    json(relative) {
        const url = this.base + '/' + relative;
        if (!this.pending.has(url)) this.pending.set(url, fetch(url, {cache:'no-cache'}).then(response => {
            if (!response.ok) throw new Error(url + ': HTTP ' + response.status);
            return response.json();
        }).catch(error => { this.pending.delete(url); throw error; }));
        return this.pending.get(url);
    }
    manifest() { return this.json('manifest.json'); }
    async table(name) {
        const manifest = await this.manifest();
        const info = manifest.tables[name];
        if (!info) throw new Error('Missing remote table: ' + name);
        return this.json(info.path);
    }
    async optionalTable(name) {
        const manifest = await this.manifest();
        return manifest.tables[name] ? this.table(name) : [];
    }
    async texts(keys, language) {
        const manifest = await this.manifest();
        if (!manifest.languages.includes(language)) throw new Error('Unsupported language: ' + language);
        const result = {...await this.json(language + '/texts/catalog.json')};
        const buckets = new Set();
        const count = manifest.textShards || 256;
        const width = (count - 1).toString(16).length;
        for (const key of keys) {
            if (!Object.hasOwn(result, key) && /^\d+$/.test(key)) buckets.add((BigInt(key) % BigInt(count)).toString(16).padStart(width, '0'));
        }
        const parts = await Promise.all([...buckets].map(bucket => this.json(language + '/texts/' + bucket + '.json')));
        for (const part of parts) Object.assign(result, part);
        return result;
    }
    async localize(records, language) {
        const keys = new Set();
        function collect(value) {
            if (Array.isArray(value)) value.forEach(collect);
            else if (value && typeof value === 'object') {
                if (value.Hash !== undefined) keys.add(String(value.Hash));
                Object.values(value).forEach(collect);
            }
        }
        collect(records);
        const text = await this.texts(keys, language);
        function visit(value) {
            if (Array.isArray(value)) return value.map(visit);
            if (value && typeof value === 'object') {
                if (Object.keys(value).length === 1 && value.Hash !== undefined) return text[String(value.Hash)] ?? '[' + value.Hash + ']';
                return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, visit(item)]));
            }
            return value;
        }
        return visit(records);
    }
    async logic(sourcePath) {
        const index = await this.json('common/logic/index.json');
        if (!index[sourcePath]) throw new Error('Missing game logic: ' + sourcePath);
        return (await this.json(index[sourcePath]))[sourcePath];
    }
    async allTexts(language, progress = () => {}) {
        const manifest = await this.manifest();
        const files = manifest.texts[language]?.files;
        if (!files) throw new Error('Unsupported language: ' + language);
        const result = {};
        let next = 0, completed = 0;
        async function worker(store) {
            while (next < files.length) {
                const file = files[next++];
                Object.assign(result, await store.json(file.path));
                progress(++completed, files.length);
            }
        }
        await Promise.all(Array.from({length:8}, () => worker(this)));
        return result;
    }
}

export function valueOf(value) {
    return value && typeof value === 'object' && 'Value' in value ? value.Value : value;
}

export function formatParameters(text, params = []) {
    return String(text ?? '').replace(/#(\d+)\[([ipf])(\d*)\]([%％]?)/g, (token, index, type, digits, suffix) => {
        const value = valueOf(params[Number(index) - 1]);
        if (typeof value !== 'number') return token;
        const percent = type === 'p' || Boolean(suffix);
        if (type === 'i') return String(Math.round(value * (percent ? 100 : 1))) + suffix;
        const precision = digits ? Number(digits) : 2;
        return Number((value * (percent ? 100 : 1)).toFixed(precision)) + (suffix || (percent ? '%' : ''));
    });
}

export function promotionStats(row, level) {
    const mappings = {HP: ['HPBase', 'HPAdd'], ATK: ['AttackBase', 'AttackAdd'], DEF: ['DefenceBase', 'DefenceAdd'], SPD: ['SpeedBase', 'SpeedAdd']};
    const result = {};
    for (const [key, [base, add]] of Object.entries(mappings)) {
        if (row[base] !== undefined) result[key] = valueOf(row[base]) + valueOf(row[add] ?? 0) * (level - 1);
    }
    for (const [key, base] of Object.entries({HP:'BaseHP',ATK:'BaseAttack',DEF:'BaseDefence'})) {
        if (row[base] !== undefined) result[key] = valueOf(row[base]) + valueOf(row[base+'Add'] ?? 0) * (level - 1);
    }
    return result;
}

export function monsterStats(template, instance, hard, elite) {
    const fields={HP:['HPBase','HPModifyRatio','HPRatio'],ATK:['AttackBase','AttackModifyRatio','AttackRatio'],DEF:['DefenceBase','DefenceModifyRatio','DefenceRatio'],SPD:['SpeedBase','SpeedModifyRatio','SpeedRatio'],Stance:['StanceBase','StanceModifyRatio','StanceRatio']};
    return Object.fromEntries(Object.entries(fields).map(([key,[base,modify,ratio]])=>[key,
        valueOf(template[base]??0)*valueOf(instance[modify]??1)*valueOf(hard[ratio]??1)*valueOf(elite[ratio]??1)+valueOf(instance[modify.replace('Ratio','Value')]??0)]));
}

export const gameData = new GameData();
