import assert from 'node:assert/strict';
import {posterLocalities} from '../js/poster-localities.js';
import {localityBounds,loadRouteLocalities} from '../js/video-localities.js';
const signal=new AbortController().signal;
const inside=(p,[s,w,n,e])=>p.lat>=s&&p.lat<=n&&p.lon>=w&&p.lon<=e;
const base=[{lat:20,lon:-100,d:0,segmentId:0},{lat:20,lon:-99.5,d:52303,segmentId:0}];
assert.deepEqual(localityBounds(base),[19.98,-100.02,20.02,-99.48],'el área predeterminada del video no cambia');
const reproduced={name:'Ciudad fuera caja',place:'city',lat:20.025,lon:-99.75};
let calls=0;
const request=place=>async url=>{
  calls++;
  const bbox=new URL(url,'https://test').searchParams.get('bbox').split(',').map(Number);
  assert(inside(place,bbox),'CARTEL-IA02-02: el proveedor solo puede devolver candidatos dentro del área solicitada');
  return Response.json({places:inside(place,bbox)?[place]:[]});
};
assert((await posterLocalities(base,signal,{external:true,fetcher:request(reproduced)})).places.some(p=>p.name===reproduced.name));
const radii={city:3000,town:2500,village:1500,hamlet:900,unclassified:600};
let index=1;
for(const latitude of [20,65])for(const [kind,radius] of Object.entries(radii))for(const delta of [-2,0,2]){
  const lat=latitude+index++*.1;
  const points=base.map(p=>({...p,lat,lon:p.lon+130}));
  const place={name:'Referencia de borde',place:kind,lat:lat+(radius+delta)/111320,lon:30.25};
  const r=await posterLocalities(points,signal,{external:true,fetcher:request(place)});
  assert.equal([...r.places,...r.spares].some(p=>p.name===place.name),delta<=0,`${kind} a radio ${delta>=0?'+':''}${delta} m en latitud ${latitude}`);
}
for(const latitude of [20,65])for(const direction of [-1,1]){
  const lat=latitude+5+direction*.1;
  const points=base.map(p=>({...p,lat,lon:p.lon+130}));
  const place={name:'Ciudad lateral',place:'city',lat,lon:(direction<0?30:30.5)+direction*2998/(111320*Math.cos(lat*Math.PI/180))};
  const r=await posterLocalities(points,signal,{external:true,fetcher:request(place)});
  assert(r.places.some(p=>p.name===place.name),'cobertura este/oeste corregida por latitud');
}
// La consulta del video sigue siendo independiente de las cajas ampliadas del cartel.
let videoCalls=0;
await loadRouteLocalities(base,signal,async url=>{videoCalls++;assert.deepEqual(new URL(url,'https://test').searchParams.get('bbox').split(',').map(Number),localityBounds(base));return Response.json({places:[]})});
assert.equal(videoCalls,1,'caché del cartel no ocupa la caja del video');
assert(calls>0);
console.log('PASS CARTEL-IA02-02: consulta → selección, cinco radios y bordes este/oeste a 20°/65°; video independiente.');
