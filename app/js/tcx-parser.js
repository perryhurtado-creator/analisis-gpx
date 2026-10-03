import {all,childText,finalize} from './gpx-parser.js';

export function parseTCX(xmlText,file){
  const xml=new DOMParser().parseFromString(xmlText,'application/xml');
  if(xml.querySelector('parsererror')) throw Error('El archivo no contiene XML válido.');
  const raw=all(xml,'Trackpoint');
  if(raw.length<2) throw Error('No encontré suficientes puntos de recorrido en este archivo.');
  const p=[];
  for(const node of raw){
    const pos=all(node,'Position')[0];
    const lat=Number(childText(pos||node,'LatitudeDegrees'));
    const lon=Number(childText(pos||node,'LongitudeDegrees'));
    const ele=Number(childText(node,'AltitudeMeters'));
    const time=Date.parse(childText(node,'Time'));
    const heart=all(node,'HeartRateBpm')[0];
    const hr=Number(childText(heart||node,'Value'));
    const cad=Number(childText(node,'Cadence'));
    const speed=Number(childText(node,'Speed'));
    if(Number.isFinite(lat)&&Number.isFinite(lon)){
      p.push({lat,lon,ele:Number.isFinite(ele)?ele:null,time:Number.isFinite(time)?time:null,
        hr:Number.isFinite(hr)&&hr>0?hr:null,cad:Number.isFinite(cad)&&cad>0?cad:null,
        speed:Number.isFinite(speed)&&speed>0?speed*3.6:null,d:0,up:0});
    }
  }
  return finalize(xml,p,'TCX',file);
}
