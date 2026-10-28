import assert from 'node:assert/strict';
import {posterMapSnapshot,posterCoordinate,posterData} from '../js/poster-data.js';
import {posterLocalities} from '../js/poster-localities.js';
import {drawPoster} from '../js/poster.js';
const place={name:'Ciudad de prueba dispersa',lat:20.005,lon:-99.75,place:'city'};
const signal=new AbortController().signal;
for(const steps of [1,524,5240]){
  const points=Array.from({length:steps+1},(_,i)=>({lat:20,lon:-100+.5*i/steps,d:52303*i/steps,segmentId:0}));
  const snapshot=posterMapSnapshot(points,1080,1460,70);
  const result=await posterLocalities(points,signal,{external:true,fetcher:async()=>Response.json({places:[place]})});
  const label=[...result.places,...result.spares].find(p=>p.name===place.name);
  assert(label,'la localidad seleccionada llega al dibujo');
  // Interceptar las operaciones reales del dibujante, sin sustituir su colocación.
  for(const spare of [false,true]){
    const dots=[];
    const ctx=new Proxy({measureText:()=>({width:170}),arc:(x,y,r)=>{if(r===5)dots.push({x,y})}},{get:(obj,key)=>key in obj?obj[key]:()=>{}});
    const source={name:'Regresión dispersa',points,distance:52303,ascent:0};
    drawPoster({getContext:()=>ctx},source,{...posterData(source),showLocalities:true,showProfile:false,showTips:false},
      {snapshot,map:{},logo:{naturalWidth:284,naturalHeight:265},localities:spare?[]:[label],localitySpares:spare?[label]:[]});
    const expected=posterCoordinate(snapshot,place);
    assert.equal(dots.length,1);
    assert(Math.hypot(dots[0].x-expected.x,dots[0].y-expected.y)<1,`CARTEL-IA02-01: ${steps+1} puntos, sustituta=${spare}: marcador real ${JSON.stringify(expected)}, obtenido ${JSON.stringify(dots[0])}`);
  }
}
console.log('PASS CARTEL-IA02-01: selección → dibujo, coordenadas reales con 2/525/5241 puntos y sustitutas.');
