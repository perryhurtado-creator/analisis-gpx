import assert from 'node:assert/strict';
import {sampleVideoPoint,createVideoScene,VIDEO_SECONDS,VIDEO_FPS} from '../js/video-capture.js';
import {createMap,videoMapSnapshot} from '../js/map.js';
import {completeWebmDuration} from '../js/webm-duration.js';
const points=[{lat:20.6,lon:-100.4,d:0,ele:100,speed:10,segmentId:0},{lat:20.61,lon:-100.39,d:1000,ele:200,speed:20,segmentId:0},{lat:20.63,lon:-100.38,d:1000,ele:null,speed:null,segmentId:1,breakBefore:true},{lat:20.64,lon:-100.37,d:2000,ele:250,speed:30,segmentId:1}];
let p=sampleVideoPoint(points,1/6);assert.equal(p.point.ele,150);assert.equal(p.point.d,500);
p=sampleVideoPoint(points,.5);assert.equal(p.mix,0);assert.equal(p.point.lat,points[1].lat);
p=sampleVideoPoint(points,5/6);assert.equal(p.point.ele,null);assert.equal(p.point.d,1500);
assert.equal(sampleVideoPoint(points,1).index,3);assert.equal(VIDEO_SECONDS*VIDEO_FPS,450);
let viewport={x:360,y:450};
const project=([lat,lon],zoom)=>({x:(lon+180)/360*256*2**zoom,y:(180-lat)/360*256*2**zoom});
const map={fitBounds(){},invalidateSize(){},remove(){},project,getSize:()=>viewport,getZoom:()=>7,getPixelBounds:()=>({min:{x:0,y:0},max:viewport})};
const layer={addTo(){return this},bindTooltip(){return this},setLatLng(){return this},setStyle(){return this}};
globalThis.window={L:{map:()=>map,latLngBounds:p=>p,tileLayer:()=>layer,polyline:()=>layer,featureGroup:()=>layer,circleMarker:()=>layer}};
const calls=[];
function canvas(){return {width:0,height:0,getContext(){return new Proxy({measureText:text=>({width:text.length*15}),getImageData:()=>({}),drawImage:(...a)=>calls.push(a)}, {get:(t,k)=>k in t?t[k]:()=>{}})}}}
globalThis.document={getElementById:()=>({innerHTML:'',textContent:''}),createElement:canvas};
createMap(points,'videoMap');const narrow=videoMapSnapshot(points);viewport={x:1400,y:800};assert.deepEqual(videoMapSnapshot(points),narrow);
assert.equal(narrow.width,1080);assert.equal(narrow.height,1190);
for(const p of narrow.positions){assert(p.x>=80&&p.x<=1000);assert(p.y>=80&&p.y<=1110)}
// Cada celda interior del mapa debe quedar cubierta por una imagen de mosaico.
for(let y=0;y<1190;y+=25)for(let x=0;x<1080;x+=25)assert(narrow.tiles.some(t=>x>=t.x&&x<t.x+256&&y>=t.y&&y<t.y+256));
globalThis.Image=class{naturalWidth=64;naturalHeight=83;set src(url){if(url)queueMicrotask(()=>this.onload?.())}};
const scene=await createVideoScene({name:'Ruta de prueba',points},new AbortController().signal);assert.equal(scene.canvas.width,1080);assert.equal(scene.canvas.height,1920);scene.draw(0,0);scene.draw(1,.5);scene.draw(3,1);
assert(calls.length>narrow.tiles.length);
// WebM de streaming mínimo: Segment desconocido, Info con TimestampScale de 1 ms.
const bytes=Uint8Array.from([0x18,0x53,0x80,0x67,0xff,0x15,0x49,0xa9,0x66,0x87,0x2a,0xd7,0xb1,0x83,0x0f,0x42,0x40]);
const fixed=new Uint8Array(await (await completeWebmDuration(new Blob([bytes],{type:'video/webm'}),15000)).arrayBuffer());
assert.equal(new DataView(fixed.buffer).getFloat64(fixed.length-8),15000);
const again=await completeWebmDuration(new Blob([fixed],{type:'video/webm'}),16000);assert.equal(again.size,fixed.length);
await assert.rejects(()=>completeWebmDuration(new Blob([new Uint8Array([0])]),15000));
console.log('PASS: interpolación, cortes, datos ausentes, encuadre independiente del móvil, cobertura completa, escena vertical y duración WebM.');
