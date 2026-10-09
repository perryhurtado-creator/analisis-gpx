import {currentLocation} from './device-location.js';
import {elevationProfile,elevationSVG} from './planner-elevation.js';
import {addPlannerLayers} from './planner-layers.js';
let map=null,markers=[],routeLayer=null,route=null,controller=null,revision=0,observer=null,editMode=null;
const $=id=>document.getElementById(id);
const status=text=>{$('plannerStatus').textContent=text};
function invalidateRoute(){
  revision++;controller?.abort();controller=null;route=null;
  if(routeLayer){routeLayer.remove();routeLayer=null}
  $('plannerDistance').textContent='—';$('plannerDuration').textContent='—';
  $('plannerAscent').textContent='—';$('plannerDescent').textContent='—';$('plannerAltitude').textContent='—';$('plannerElevationStatus').textContent='';$('plannerElevationChart').innerHTML='<div class="chart-empty">Calcula una ruta para ver la altimetría.</div>';$('plannerDownload').disabled=true;
  $('plannerInvert').disabled=markers.length<2;$('plannerRetry').disabled=markers.length<2;
  $('plannerAdd').disabled=markers.length<2||markers.length>=50;$('plannerMoveOrigin').disabled=false;$('plannerMoveDestination').disabled=markers.length<2;
}
function pinIcon(index){
  const end=markers.length>=2&&index===markers.length-1;
  const letter=index===0?'A':end?'B':String(index);
  return window.L.divIcon({className:'planner-marker',html:`<span class="planner-pin ${end?'destination':index?'waypoint':''}">${letter}</span>`,iconSize:[32,32],iconAnchor:[16,16]});
}
function labels(){
  const endpoints=[markers[0],markers.length>=2?markers.at(-1):null];
  ['plannerOrigin','plannerDestination'].forEach((id,i)=>{const p=endpoints[i]?.getLatLng();$(id).textContent=p?`${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`:'Sin seleccionar'});
  markers.forEach((m,i)=>{m.setIcon(pinIcon(i));m.setTooltipContent(i===0?'A · Origen':i===markers.length-1?'B · Destino':`Punto intermedio ${i}`)});
  $('plannerPointCount').textContent=`${markers.length} puntos · Origen → Destino`;
  $('plannerWaypoints').innerHTML=markers.slice(1,-1).map((m,i)=>{const p=m.getLatLng();return `<li><span><b>Punto ${i+1}</b> · ${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}</span><button type="button" class="action-btn secondary" data-remove-waypoint="${i+1}" aria-label="Eliminar punto intermedio ${i+1}">Eliminar</button></li>`}).join('');
}
function marker(point){
  const m=window.L.marker(point,{draggable:true,icon:window.L.divIcon({className:'planner-marker',html:'',iconSize:[32,32],iconAnchor:[16,16]})}).addTo(map).bindTooltip('Punto de ruta');
  m.on('dragstart',()=>{editMode=null;invalidateRoute();status('Mueve el punto y suéltalo para recalcular.')});
  m.on('dragend',()=>{labels();if(markers.length>=2)calculate();else status('Toca el mapa para marcar B · Destino.')});
  return m;
}
async function calculate(){
  invalidateRoute();if(markers.length<2)return;
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
    const profile=elevationProfile(data.geometry.coordinates,data.distance);
    const height=n=>Number.isFinite(n)?Math.round(n).toLocaleString('es-MX')+' m':'No disponible';
    $('plannerAscent').textContent=height(profile.ascent);$('plannerDescent').textContent=height(profile.descent);$('plannerAltitude').textContent=profile.min!==null?height(profile.min)+' – '+height(profile.max):'No disponible';
    $('plannerElevationChart').innerHTML=elevationSVG(profile);
    $('plannerElevationStatus').textContent=data.elevation?.message||'Altimetría estimada del terreno SRTM. Gráfica y acumulados calculados con las mismas alturas.';
    $('plannerDownload').disabled=false;status('Ruta lista. Arrastra cualquier punto para recalcular o pulsa Añadir punto intermedio.');
  }catch(error){if(current===revision&&error.name!=='AbortError')status(error.message)}finally{if(current===revision)controller=null}
}
const searches={Origin:{controller:null,revision:0,results:[]},Destination:{controller:null,revision:0,results:[]}};
function cancelPlaceSearch(target){
  for(const name of target?[target]:Object.keys(searches)){
    const search=searches[name];search.revision++;search.controller?.abort();search.controller=null;search.results=[];
    $(`planner${name}Results`).replaceChildren();$(`planner${name}SearchStatus`).textContent='';$(`planner${name}SearchButton`).disabled=false;
  }
}
function setupPlaceSearch(target){
  const search=searches[target],get=suffix=>$(`planner${target}${suffix}`);
  get('Search').onsubmit=async e=>{
    e.preventDefault();cancelPlaceSearch(target);const q=get('Query').value.trim();
    if(!q){
      const current=search.revision;get('SearchButton').disabled=true;get('SearchStatus').textContent='Solicitando permiso para acceder a la ubicación del dispositivo…';
      try{const place=await currentLocation();if(current===search.revision)selectPlace(target,place)}
      catch(error){if(current===search.revision)get('SearchStatus').textContent=error.message}
      finally{if(current===search.revision)get('SearchButton').disabled=false}
      return;
    }
    if(q.length<3||q.length>160){get('SearchStatus').textContent='Escribe una localidad de entre 3 y 160 caracteres.';return}
    const current=search.revision;search.controller=new AbortController();get('SearchButton').disabled=true;get('SearchStatus').textContent='Buscando localidades…';
    const center=map.getCenter(),params=new URLSearchParams({q,lat:String(center.lat),lon:String(center.lng)});
    try{
      const response=await fetch('/api/places?'+params,{signal:search.controller.signal});
      const data=await response.json();if(current!==search.revision)return;
      if(!response.ok)throw Error(data.error||'No se pudo buscar la localidad.');
      if(!Array.isArray(data.places))throw Error('El buscador devolvió una respuesta inválida.');
      search.results=data.places;
      for(const [index,place] of search.results.entries()){
        const li=document.createElement('li'),button=document.createElement('button');button.type='button';button.className='planner-place-result';button.dataset.placeIndex=String(index);button.textContent=place.label;li.append(button);get('Results').append(li);
      }
      get('SearchStatus').textContent=search.results.length?`Selecciona una localidad para establecer ${target==='Origin'?'el inicio':'el destino'}.`:'No se encontraron localidades. Prueba incluyendo municipio y estado.';
    }catch(error){if(current===search.revision&&error.name!=='AbortError')get('SearchStatus').textContent=error.message}
    finally{if(current===search.revision){search.controller=null;get('SearchButton').disabled=false}}
  };
  get('Query').oninput=()=>cancelPlaceSearch(target);
  get('Results').onclick=e=>{
    const button=e.target.closest('[data-place-index]');if(!button)return;const place=search.results[Number(button.dataset.placeIndex)];if(!place)return;
    selectPlace(target,place);
  };
}
function selectPlace(target,place){
    if(target==='Destination'&&!markers.length){$(`planner${target}SearchStatus`).textContent='Selecciona primero el inicio A y después elige este destino.';return}
    const point={lat:place.lat,lng:place.lon};editMode=null;invalidateRoute();
    if(target==='Origin'){if(markers.length)markers[0].setLatLng(point);else markers.push(marker(point))}
    else if(markers.length>=2)markers.at(-1).setLatLng(point);else markers.push(marker(point));
    labels();invalidateRoute();map.setView(point,place.zoom||13);cancelPlaceSearch(target);$(`planner${target}SearchStatus`).textContent=(target==='Origin'?'Inicio: ':'Destino: ')+place.label;
    if(markers.length>=2)calculate();else status('Inicio seleccionado. Toca el mapa o busca una localidad para marcar B · Destino.');
}
export function routeGPX(data){
  const nodes=data.geometry.coordinates.map(c=>`<trkpt lat="${c[1]}" lon="${c[0]}">${Number.isFinite(c[2])?`<ele>${c[2]}</ele>`:''}</trkpt>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Perros en Bicicleta" xmlns="http://www.topografix.com/GPX/1/1"><metadata><name>Ruta MTB planificada</name><desc>Recorrido calculado por openrouteservice con datos de OpenStreetMap. Sin tiempos registrados.</desc></metadata><trk><name>Ruta MTB planificada</name><type>cycling</type><trkseg>${nodes}</trkseg></trk></gpx>`;
}
export function openPlanner(){
  if(map){requestAnimationFrame(()=>map.invalidateSize());return}
  const L=window.L;if(!L){status('No se pudo cargar Leaflet. Revisa tu conexión y recarga.');return}
  map=L.map('plannerMap').setView([20.5888,-100.3899],12);
  addPlannerLayers(map,L);
  setupPlaceSearch('Origin');setupPlaceSearch('Destination');
  map.on('click',e=>{
    if(editMode==='origin'||editMode==='destination'){
      if(!markers.length)markers.push(marker(e.latlng));else markers[editMode==='origin'?0:markers.length-1].setLatLng(e.latlng);editMode=null;labels();
      if(markers.length>=2)calculate();else status('Toca el mapa para marcar B · Destino.');return;
    }
    if(markers.length>=2){
      if(editMode!=='add'){status('Pulsa Añadir punto intermedio o arrastra un marcador para modificar la ruta.');return}
      if(markers.length>=50){status('Puedes utilizar hasta 50 puntos en una ruta.');return}
      markers.splice(markers.length-1,0,marker(e.latlng));editMode=null;
    }else markers.push(marker(e.latlng));
    labels();invalidateRoute();
    if(markers.length>=2)calculate();else status('Toca el mapa para marcar B · Destino.');
  });
  $('plannerAdd').onclick=()=>{if(markers.length<2||markers.length>=50)return;editMode='add';status('Toca el mapa para añadir un punto intermedio antes del destino B.')};
  $('plannerMoveOrigin').onclick=()=>{editMode='origin';$('plannerOriginQuery').focus();status('Busca una localidad o toca el mapa para elegir A · Origen.')};
  $('plannerMoveDestination').onclick=()=>{if(markers.length<2)return;editMode='destination';$('plannerDestinationQuery').focus();status('Busca una localidad o toca el mapa para cambiar B · Destino.')};
  $('plannerWaypoints').onclick=e=>{
    const button=e.target.closest('[data-remove-waypoint]');if(!button)return;
    const index=Number(button.dataset.removeWaypoint);if(!Number.isInteger(index)||index<1||index>=markers.length-1)return;
    editMode=null;markers.splice(index,1)[0].remove();labels();calculate();
  };
  $('plannerClear').onclick=()=>{cancelPlaceSearch();editMode=null;invalidateRoute();markers.forEach(m=>m.remove());markers=[];labels();invalidateRoute();status('Toca el mapa para marcar A · Origen.')};
  $('plannerInvert').onclick=()=>{if(markers.length<2)return;editMode=null;markers.reverse();labels();calculate()};
  $('plannerRetry').onclick=calculate;
  $('plannerDownload').onclick=()=>{
    if(!route)return;const url=URL.createObjectURL(new Blob([routeGPX(route)],{type:'application/gpx+xml'}));
    const a=document.createElement('a');a.href=url;a.download='Ruta_MTB_Perros_en_Bicicleta.gpx';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  if(window.ResizeObserver){observer=new ResizeObserver(()=>map.invalidateSize());observer.observe($('plannerMap'))}
  requestAnimationFrame(()=>map.invalidateSize());
}
