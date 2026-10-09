import {all,childText,finalize,optionalNumber,appendRuns} from './gpx-parser.js';

function parsePoint(node){
  const pos=all(node,'Position')[0];
  const lat=optionalNumber(childText(pos||node,'LatitudeDegrees'));
  const lon=optionalNumber(childText(pos||node,'LongitudeDegrees'));
  if(lat===null||lon===null||lat < -90||lat > 90||lon < -180||lon > 180)return null;
  const ele=optionalNumber(childText(node,'AltitudeMeters'));
  const timeRaw=childText(node,'Time');
  const parsedTime=timeRaw?Date.parse(timeRaw):NaN;
  const heart=all(node,'HeartRateBpm')[0];
  const hr=optionalNumber(childText(heart||node,'Value'));
  const cad=optionalNumber(childText(node,'Cadence'));
  const speed=optionalNumber(childText(node,'Speed'));
  return {lat,lon,ele,time:Number.isFinite(parsedTime)?parsedTime:null,
    hr:hr!==null&&hr>0?hr:null,cad:cad!==null&&cad>0?cad:null,
    speed:speed!==null&&speed>=0?speed*3.6:null,d:0,up:0};
}

export function parseTCX(xmlText,file){
  const xml=new DOMParser().parseFromString(xmlText,'application/xml');
  if(xml.querySelector('parsererror'))throw Error('El archivo no contiene XML válido.');
  const groups=all(xml,'Track').map(track=>all(track,'Trackpoint')).filter(points=>points.length);
  if(!groups.length)groups.push(all(xml,'Trackpoint'));
  const raw=groups.flat();
  if(raw.length<2)throw Error('No encontré suficientes puntos de recorrido en este archivo.');
  return finalize(xml,appendRuns(groups,parsePoint),'TCX',file);
}

