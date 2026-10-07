import{all,childText,collectTrackPoints,finalize,optionalNumber,validCoordinates}from'./gpx-parser.js';

function parseTime(raw){
  if(!raw||!raw.trim())return null;
  const time=Date.parse(raw);
  return Number.isFinite(time)?time:null;
}

export function parseTCX(xmlText,file){
  const xml=new DOMParser().parseFromString(xmlText,'application/xml');
  if(xml.querySelector?.('parsererror'))throw Error('El archivo no contiene XML válido.');
  const tracks=all(xml,'Track').map(track=>all(track,'Trackpoint')).filter(group=>group.length);
  const groups=tracks.length?tracks:[all(xml,'Trackpoint')];
  if(groups.reduce((sum,group)=>sum+group.length,0)<2)
    throw Error('No encontré suficientes puntos de recorrido en este archivo.');
  const points=collectTrackPoints(groups,node=>{
    const position=all(node,'Position')[0];
    const lat=optionalNumber(childText(position||node,'LatitudeDegrees'));
    const lon=optionalNumber(childText(position||node,'LongitudeDegrees'));
    if(!validCoordinates(lat,lon))return null;
    const heart=all(node,'HeartRateBpm')[0];
    const hr=optionalNumber(childText(heart||node,'Value'));
    const cadence=optionalNumber(childText(node,'Cadence'));
    const speed=optionalNumber(childText(node,'Speed'));
    return{
      lat,lon,
      ele:optionalNumber(childText(node,'AltitudeMeters')),
      time:parseTime(childText(node,'Time')),
      hr:hr!==null&&hr>0?hr:null,
      cad:cadence!==null&&cadence>0?cadence:null,
      speed:speed!==null&&speed>0?speed*3.6:null
    };
  });
  return finalize(xml,points,'TCX',file);
}
