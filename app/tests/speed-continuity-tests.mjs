import assert from 'node:assert/strict';
import {finalize,parseGPX} from '../js/gpx-parser.js';
import {parseTCX} from '../js/tcx-parser.js';
const xml={getElementsByTagNameNS:()=>[],getElementsByTagName:()=>[]};
const point=(lat,time,extra={})=>({lat,lon:-100,ele:null,time,speed:null,d:0,up:0,segmentId:0,breakBefore:false,...extra});
const points=[point(20,0,{breakBefore:true}),point(20.000001,1000),point(20.000001,2000),point(20.000002,3000),point(21,4000,{breakBefore:true,segmentId:1}),point(21.000001,5000,{segmentId:1})];
finalize(xml,points,'GPX','test.gpx');
assert(points[1].speed>0&&points[1].speed<3.6,'Conservar velocidad calculada para desplazamientos inferiores a 1 m');
assert.equal(points[2].speed,0,'Una parada con tiempo válido vale 0 km/h');
assert(Number.isFinite(points[3].speed));assert.equal(points[4].speed,null,'No calcular atravesando segmentos');assert(points[5].speed>0);
const noTime=[point(20,null),point(20.000001,null)];finalize(xml,noTime,'GPX','test.gpx');assert.equal(noTime[1].speed,null);
const longGap=[point(20,0),point(20.000001,31000)];finalize(xml,longGap,'GPX','test.gpx');assert.equal(longGap[1].speed,null);
// XML mínimo simulado para verificar la lectura de velocidad explícita en ambos formatos.
function node(fields,attributes={}){return {textContent:'',getAttribute:k=>attributes[k]??null,getElementsByTagNameNS:(_,k)=>fields[k]===undefined?[]:[{textContent:String(fields[k])}],getElementsByTagName:()=>[]}}
for(const type of ['GPX','TCX'])for(const raw of ['0','','-1']){
 const nodes=Array.from({length:2},(_,i)=>type==='GPX'?node({speed:raw},{lat:String(20+i*.001),lon:'-100'}):node({LatitudeDegrees:20+i*.001,LongitudeDegrees:-100,Speed:raw}));
 const pointTag=type==='GPX'?'trkpt':'Trackpoint',groupTag=type==='GPX'?'trkseg':'Track';
 const group={getElementsByTagNameNS:(_,name)=>name===pointTag?nodes:[],getElementsByTagName:()=>[]};
 globalThis.DOMParser=class{parseFromString(){return {...xml,querySelector:()=>null,getElementsByTagNameNS:(_,name)=>name===groupTag?[group]:[]}}};
 const activity=(type==='GPX'?parseGPX:parseTCX)('',`test.${type.toLowerCase()}`);
 assert.equal(activity.points[0].speed,raw==='0'?0:null,`${type}: cero explícito válido, vacío o negativo ausente`);
}
console.log('PASS: velocidades bajas, paradas, timestamps en cero, datos ausentes, intervalos largos, cortes reales y ceros explícitos GPX/TCX.');
