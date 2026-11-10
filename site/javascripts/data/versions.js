const ranks=new Map();
export function versionRank(version='') {
    if(!ranks.has(version)){
        const numbers=String(version).match(/^(\d+)\.(\d+)/);
        ranks.set(version,numbers?Number(numbers[1])*10000+Number(numbers[2])*100-(version.includes('以前')?1:0):-1);
    }
    return ranks.get(version);
}
export function newestFirst(a,b){return versionRank(b)-versionRank(a);}
export function sortVersions(versions){return [...new Set(versions)].sort(newestFirst);}

export async function loadVersions(store) {
    const data=await store.json('metadata/versions.json');
    const texts=new Map(),tables=new Map();
    for(const [version,ids] of Object.entries(data.texts))for(const id of ids)texts.set(String(id),version);
    function table(name){
        if(!tables.has(name)){
            const values=new Map();
            for(const [version,ids] of Object.entries(data.tables[name]?.versions || {}))for(const id of ids)values.set(String(id),version);
            tables.set(name,values);
        }
        return tables.get(name);
    }
    return {
        text(id){return texts.get(String(id)) || '';},
        record(row){
            const info=data.tables[row._table];
            const known=info&&table(row._table).get(String(row[info.idField]));
            if(known)return known;
            const versions=Object.entries(row).filter(([key,value])=>/Name|Title/.test(key)&&value?.Hash).map(([,value])=>texts.get(String(value.Hash))).filter(Boolean);
            return versions.sort(newestFirst)[0] || '';
        }
    };
}

export function compareEntries(a,b){
    const difference=newestFirst(a.version || a.ReleaseVersion,b.version || b.ReleaseVersion);
    if(difference)return difference;
    const left=String(a.id ?? ''),right=String(b.id ?? '');
    return right.length-left.length || (right>left?1:right<left?-1:0);
}
