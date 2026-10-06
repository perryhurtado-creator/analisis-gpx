let leaflet=null,leafletMarker=null,mapKind='leaflet',resizeObserver=null;
const engineEl=()=>document.getElementById('engine');
export function getMapState(){return {map:null,leaflet,mapKind}};
function setEngine(main,fallback=''){if(engineEl())engineEl().innerHTML=`<span class="tag">${main}</span>${fallback?`<span class="tag fallback">${fallback}</span>`:''}}
function setStatus(t){const el=document.getElementById('mapStatus');if(el)el.textContent=t}
export function clearMap(){
  if(leaflet){leaflet.remove();leaflet=null}
  leafletMarker=null;
  const host=document.getElementById('map');if(host)host.innerHTML='';
}
export function createMap(points,containerId='map'){
  clearMap();
  const host=document.getElementById(containerId);
  if(!host||!points?.length||!window.L)return;
  leaflet=L.map(containerId,{zoomControl:true,attributionControl:true,preserveDrawingBuffer:true});
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(leaflet);
  const line=L.polyline(points.map(p=>[p.lat,p.lon]),{color:'#2a9b69',weight:5,opacity:.9}).addTo(leaflet);
  L.circleMarker([points[0].lat,points[0].lon],{radius:6,color:'#fff',weight:2,fillColor:'#2a9b69',fillOpacity:1}).addTo(leaflet).bindTooltip('Inicio');
  L.circleMarker([points.at(-1).lat,points.at(-1).lon],{radius:6,color:'#fff',weight:2,fillColor:'#ee5c73',fillOpacity:1}).addTo(leaflet).bindTooltip('Final');
  leafletMarker=L.circleMarker([points[0].lat,points[0].lon],{radius:8,color:'#fff',weight:2,fillColor:'#ff9f43',fillOpacity:0,opacity:0}).addTo(leaflet);
  leaflet.fitBounds(line.getBounds(),{padding:[28,28]});
  setEngine('OpenStreetMap','Leaflet');
  setStatus('OpenStreetMap');
  if(!resizeObserver){resizeObserver=new ResizeObserver(()=>leaflet&&leaflet.invalidateSize());resizeObserver.observe(host)}
  setTimeout(()=>leaflet&&leaflet.invalidateSize(),100);
}
export function fitRoute(points){
  if(leaflet&&points?.length)leaflet.fitBounds(L.latLngBounds(points.map(p=>[p.lat,p.lon])),{padding:[28,28]});
}
export function showPoint(p){
  if(p&&leaflet&&leafletMarker)leafletMarker.setLatLng([p.lat,p.lon]).setStyle({opacity:1,fillOpacity:1});
}
export function hidePoint(){if(leafletMarker)leafletMarker.setStyle({opacity:0,fillOpacity:0})}
export function getCanvas(){return leaflet?.getContainer()?.querySelector('.leaflet-tile-pane')||null}
export function getMapInstance(){return leaflet}
