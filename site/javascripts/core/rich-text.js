// Render game formatting through one sanitizer; names use the same parser as descriptions.
export function safeRichText(value) {
    const source=String(value ?? '').replace(/&(?:amp;)?lt;/gi,'<').replace(/&(?:amp;)?gt;/gi,'>').replace(/\\n/g,'<br>').replace(/<color=([^>]+)>/gi,'<color data-color="$1">');
    const doc=new DOMParser().parseFromString(source,'text/html');
    const allowed=new Set(['B','I','U','S','BR','EM','STRONG','COLOR','UNBREAK','RUBY','RT','RP','P']);
    for(const element of [...doc.body.querySelectorAll('*')]) {
        if(!allowed.has(element.tagName)){element.replaceWith(doc.createTextNode(element.textContent));continue;}
        const color=element.getAttribute('data-color');
        for(const attribute of [...element.attributes])element.removeAttribute(attribute.name);
        if(element.tagName==='UNBREAK'){
            const span=doc.createElement('span');span.className='game-unbreak';span.append(...element.childNodes);element.replaceWith(span);
        } else if(color && /^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i.test(color)){
            element.style.color=color.slice(0,7);
            if(color.slice(0,7).toLowerCase()==='#ffffff')element.style.backgroundColor='#27363e';
        }
    }
    return doc.body.innerHTML;
}
export function plainText(value) {
    const doc=new DOMParser().parseFromString(safeRichText(value),'text/html');
    for(const br of doc.body.querySelectorAll('br'))br.replaceWith(doc.createTextNode(' '));
    return doc.body.textContent;
}
