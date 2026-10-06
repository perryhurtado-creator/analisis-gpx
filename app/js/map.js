const maps={map:null,videoMap:null},markers={map:null,videoMap:null},observers={};
const engineEl=()=>document.getElementById('engine');
export function getMapState(){return {map:maps.map,videoMap:maps.videoMap,mapKind:'leaflet'};}
function setEngine(main,fallback=''){if(engineEl())engineEl().innerHTML=`<span class="tag">${main}</span>${fallback?`<span class="tag fallback">${fallback}</span>`:''}}
function setStatus(t,id='mapStatus'){const el=document.getElementById(id);if(el)el.textContent=t}
function destroyMap(containerId){
  if(maps[containerId]){maps[containerId].remove();maps[containerId]=null}
  markers[containerId]=null;
  if(observers[containerId]){observers[containerId].disconnect();delete observers[containerId]}
  const host=document.getElementById(containerId);if(host)host.innerHTML='';
}
export function clearMap(){destroyMap('map')}
export function createMap(points,containerId='map'){
  destroyMap(containerId);
  const host=document.getElementById(containerId);
  if(!host||!points?.length||!window.L)return;
  const map=L.map(containerId,{zoomControl:true,attributionControl:true}).setView([points[0].lat,points[0].lon],13);
  maps[containerId]=map;
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap contributors'}).addTo(map);
  const line=L.polyline(points.map(p=>[p.lat,p.lon]),{color:'#2a9b69',weight:5,opacity:.9}).addTo(map);
  L.circleMarker([points[0].lat,points[0].lon],{radius:6,color:'#fff',weight:2,fillColor:'#2a9b69',fillOpacity:1}).addTo(map).bindTooltip('Inicio');
  L.circleMarker([points.at(-1).lat,points.at(-1).lon],{radius:6,color:'#fff',weight:2,fillColor:'#ee5c73',fillOpacity:1}).addTo(map).bindTooltip('Final');
  markers[containerId]=L.circleMarker([points[0].lat,points[0].lon],{radius:8,color:'#fff',weight:2,fillColor:'#ff9f43',fillOpacity:0,opacity:0}).addTo(map);
  map.fitBounds(line.getBounds(),{padding:[28,28]});
  if(containerId==='map'){setEngine('OpenStreetMap','Leaflet');setStatus('OpenStreetMap')}
  else setStatus('OpenStreetMap','videoMapStatus');
  observers[containerId]=new ResizeObserver(()=>maps[containerId]?.invalidateSize());
  observers[containerId].observe(host);
  setTimeout(()=>map.invalidateSize(),100);
}
export function fitRoute(points){if(maps.map&&points?.length)maps.map.fitBounds(L.latLngBounds(points.map(p=>[p.lat,p.lon])),{padding:[28,28]})}
export function fitVideoRoute(points){if(maps.videoMap&&points?.length){maps.videoMap.invalidateSize();maps.videoMap.fitBounds(L.latLngBounds(points.map(p=>[p.lat,p.lon])),{padding:[28,28]})}}
function showOn(id,p){if(p&&markers[id])markers[id].setLatLng([p.lat,p.lon]).setStyle({opacity:1,fillOpacity:1})}
export function showPoint(p){showOn('map',p)}
export function showVideoPoint(p){showOn('videoMap',p)}
export function hidePoint(){if(markers.map)markers.map.setStyle({opacity:0,fillOpacity:0})}
export function hideVideoPoint(){if(markers.videoMap)markers.videoMap.setStyle({opacity:0,fillOpacity:0})}
export function getCanvas(){return null}
