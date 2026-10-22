import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {POSTER_TIMEOUT_MS,waitForPoster} from '../js/poster-task.js';
const dom=new JSDOM(readFileSync('app/index.html','utf8'));
globalThis.document=dom.window.document;
const images=[];
globalThis.Image=class{constructor(){images.push(this)}set src(value){this.url=value}get src(){return this.url}};
dom.window.HTMLCanvasElement.prototype.getContext=()=>({fillRect(){}});
const {setPosterActivity,generatePoster,cancelPoster}=await import('../js/poster.js');
const $=id=>document.getElementById(id);
const activity={name:'Prueba',file:'prueba.gpx',distance:150,ascent:0,duration:null,points:[{lat:20,lon:-100,d:0,ele:100,segmentId:0},{lat:20.001,lon:-99.999,d:150,ele:100,segmentId:0}]};
setPosterActivity(activity);$('posterLocalities').checked=false;
const first=generatePoster();assert(!$('cancelPoster').hidden);assert($('makePoster').disabled);cancelPoster();
await first;assert($('cancelPoster').hidden);assert(!$('makePoster').disabled);assert(!$('posterFont').disabled);assert($('downloadPoster').disabled);assert.match($('posterStatus').textContent,/cancelada/);assert(images.every(i=>i.url===''));
// Acelerar solo el plazo global, conservando los temporizadores de imágenes.
const realSetTimeout=globalThis.setTimeout;
globalThis.setTimeout=(fn,ms,...args)=>realSetTimeout(fn,ms===POSTER_TIMEOUT_MS?5:ms,...args);
try{await generatePoster()}finally{globalThis.setTimeout=realSetTimeout}
assert.match($('posterStatus').textContent,/tardó demasiado/);assert(!$('makePoster').disabled);assert($('cancelPoster').hidden);
const third=generatePoster();setPosterActivity({...activity,name:'Otra ruta'});await third;
assert.equal($('posterName').value,'Otra ruta');assert(!$('makePoster').disabled);assert($('cancelPoster').hidden);assert.doesNotMatch($('posterStatus').textContent,/cancelada/);
const abort=new AbortController();let finish;
const pending=new Promise(resolve=>finish=resolve);const wait=waitForPoster(pending,abort.signal);abort.abort();await assert.rejects(wait,{name:'AbortError'});finish('tarde');
const before=new AbortController();before.abort();await assert.rejects(waitForPoster(Promise.reject(Error('tarde')),before.signal),{name:'AbortError'});
dom.window.close();console.log('PASS cartel: cancelar, plazo global, controles restaurados, reintento, cambio de actividad y promesas tardías sin publicación.');
