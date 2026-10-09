let map=null,markers=[],routeLayer=null,route=null,controller=null,revision=0,observer=null;
const $=id=>document.getElementById(id);
const status=text=>{$('plannerStatus').textContent=text};
function invalidateRoute(){
  revision++;controller?.abort();controller=null;route=null;
  if(routeLayer){routeLayer.remove();routeLayer=null}
  $('plannerDistance').textContent='—';$('plannerDuration').textContent='—';$('plannerDownload').disabled=true;
  $('plannerInvert').disabled=markers.length!==2;$('plannerRetry').disabled=markers.length!==2;
}
function labels(){
  ['plannerOrigin','plannerDestination'].forEach((id,i)=>{const p=markers[i]?.getLatLng();$(id).textContent=p?`${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`:'Sin seleccionar'});
}
function marker(point,index){
  const letter=index===0?'A':'B';
  const m=window.L.marker(point,{draggable:true,icon:window.L.divIcon({className:'planner-marker',html:`<span class="planner-pin ${index?'destination':''}">${letter}</span>`,iconSize:[32,32],iconAnchor:[16,16]})}).addTo(map).bindTooltip(index===0?'A · Origen':'B · Destino');
  m.on('dragstart',()=>{invalidateRoute();status('Mueve el punto y suéltalo para recalcular.')});
  m.on('dragend',()=>{labels();if(markers.length===2)calculate();else status('Toca el mapa para marcar B · Destino.')});
  return m;
}
async function calculate(){
  invalidateRoute();if(markers.length!==2)return;
  const current=revision;controller=new AbortController();status('Calculando ruta MTB…');
  try{
    const coordinates=markers.map(m=>{const p=m.getLatLng();return[p.lng,p.lat]});
    const response=await fetch('/api/route',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({coordinates}),signal:controller.signal});
    const data=await response.json().catch(()=>{throw Error('El servicio de rutas no está publicado. Revisa el despliegue de Vercel.')});
    if(current!==revision)return;
    if(!response.ok)throw Error(data.error||'No se pudo calcular la ruta.');
    if(data.geometry?.type!=='LineString'||!data.geometry.coordinates?.length||!Number.isFinite(data.distance)||!Number.isFinite(data.duration))throw Error('El servicio devolvió una ruta inválida.');
    route=data;routeLayer=window.L.geoJSON(data.geometry,{style:{color:'#2a9b69',weight:5,opacity:.95}}).addTo(map);
    map.fitBounds(routeLayer.getBounds(),{padding:[30,30],maxZoom:16});
    $('plannerDistance').textContent=`${(data.distance/1000).toLocaleString('es-MX',{maximumFractionDigits:2})} km`;
    const minutes=Math.max(1,Math.round(data.duration/60));$('plannerDuration').textContent=minutes>=60?`${Math.floor(minutes/60)} h ${minutes%60} min`:`${minutes} min`;
    $('plannerDownload').disabled=false;status('Ruta lista. Arrastra A o B para modificarla.');
  }catch(error){if(current===revision&&error.name!=='AbortError')status(error.message)}finally{if(current===revision)controller=null}
}
export function routeGPX(data){
  const nodes=data.geometry.coordinates.map(c=>`<trkpt lat="${c[1]}" lon="${c[0]}"></trkpt>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Perros en Bicicleta" xmlns="http://www.topografix.com/GPX/1/1"><metadata><name>Ruta MTB planificada</name><desc>Recorrido calculado por openrouteservice con datos de OpenStreetMap. Sin tiempos registrados.</desc></metadata><trk><name>Ruta MTB planificada</name><type>cycling</type><trkseg>${nodes}</trkseg></trk></gpx>`;
}
export function openPlanner(){
  if(map){requestAnimationFrame(()=>map.invalidateSize());return}
  const L=window.L;if(!L){status('No se pudo cargar Leaflet. Revisa tu conexión y recarga.');return}
  map=L.map('plannerMap').setView([20.5888,-100.3899],12);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap contributors'}).addTo(map);
  map.on('click',e=>{
    if(markers.length===2){status('Arrastra A o B para cambiar los puntos, o pulsa Limpiar.');return}
    markers.push(marker(e.latlng,markers.length));labels();invalidateRoute();
    if(markers.length===2)calculate();else status('Toca el mapa para marcar B · Destino.');
  });
  $('plannerClear').onclick=()=>{invalidateRoute();markers.forEach(m=>m.remove());markers=[];labels();invalidateRoute();status('Toca el mapa para marcar A · Origen.')};
  $('plannerInvert').onclick=()=>{if(markers.length!==2)return;const a=markers[0].getLatLng(),b=markers[1].getLatLng();markers[0].setLatLng(b);markers[1].setLatLng(a);labels();calculate()};
  $('plannerRetry').onclick=calculate;
  $('plannerDownload').onclick=()=>{
    if(!route)return;const url=URL.createObjectURL(new Blob([routeGPX(route)],{type:'application/gpx+xml'}));
    const a=document.createElement('a');a.href=url;a.download='Ruta_MTB_Perros_en_Bicicleta.gpx';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  if(window.ResizeObserver){observer=new ResizeObserver(()=>map.invalidateSize());observer.observe($('plannerMap'))}
  requestAnimationFrame(()=>map.invalidateSize());
}
