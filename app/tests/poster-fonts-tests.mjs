import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {TITLE_FONTS,ensureTitleFont} from '../js/poster-fonts.js';
const manifest=JSON.parse(readFileSync('app/assets/fonts/SOURCES.json','utf8'));
assert.equal(manifest.fonts.length,5);
for(const font of Object.values(TITLE_FONTS).filter(f=>!f.local)){
 const entry=manifest.fonts.find(f=>f.file===font.file);assert(entry);
 const data=readFileSync('app/assets/fonts/'+font.file);assert.equal(data.toString('ascii',0,4),'wOFF');assert.equal(createHash('sha256').update(data).digest('hex'),entry.woffSHA256);
 assert(readFileSync('app/assets/fonts/'+entry.license,'utf8').length>1000);
}
let loads=0,added=0,fail=true;
globalThis.document={fonts:{add(){added++},check(){return true}}};
globalThis.FontFace=class{constructor(family,source){assert(source.startsWith('url("file:'));assert(!source.includes('googleapis'));this.family=family}async load(){loads++;if(fail)throw Error('offline');return this}};
assert.equal(await ensureTitleFont('classic'),true);assert.equal(loads,0);
assert.equal(await ensureTitleFont('blackops'),false);fail=false;
assert.equal(await ensureTitleFont('blackops'),true);assert.equal(loads,2);assert.equal(added,1);
await ensureTitleFont('blackops');assert.equal(loads,2);
console.log('PASS fuentes: cinco archivos locales íntegros con licencias, Arial sin descarga, caché y reintento tras fallo.');
