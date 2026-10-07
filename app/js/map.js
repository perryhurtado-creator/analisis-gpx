import{isConnected}from'./gpx-parser.js';

const maps={map:null,videoMap:null};
const markers={map:null,videoMap:null};
const observers={};

function engineEl(){return document.getElementById('engine')}
function setEngine(main,fallback=''){
  const el=engineEl();
  if(el)el.innerHTML='<span class="tag">'+main+'</span>'+(fallback?'<span class="tag fallback">'+fallback+'</span>':'');
}
function setStatus(text,id='mapStatus'){
  const el=document.getElementById(id);
  if(el)el.textContent=text;
}
function destroyMap(id){
  if(maps[id]){maps[id].remove();maps[id]=null;}
  markers[id]=null;
  if(observers[id]){observers[id].disconnect();delete observers[id];}
  const host=document.getElementById(id);
  if(host)host.innerHTML='';
}

export function splitRouteSegments(points){
  const chunks=[];let current=[],previous=null;
  const finish=()=>{if(current.length)chunks.push(current);current=[];};
  for(const point of points||[]){
    if(!Number.isFinite(point.lat)||!Number.isFinite(point.lon)){
      finish();previous=null;continue;
    }
    if(previous&&!isConnected(previous,point))finish();
    current.push([point.lat,point.lon]);
    previous=point;
  }
  finish();
  return chunks;
}

export function clearMap(){destroyMap('map')}
export function createMap(points,id='map'){
  destroyMap(id);
  const host=document.getElementById(id),L=window.L;
  if(!host||!Array.isArray(points)||points.length<2||!L)return;
  const chunks=splitRouteSegments(points).filter(chunk=>chunk.length>=2);
  if(!chunks.length)return;
  const map=L.map(host,{zoomControl:true,attributionControl:true});
  maps[id]=map;
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
    maxZoom:19,attribution:'© OpenStreetMap contributors'
  }).addTo(map);
  const lines=chunks.map(coords=>L.polyline(coords,{color:'#2a9b69',weight:5,opacity:.9}));
  const route=L.featureGroup(lines).addTo(map);
  const coords=points.filter(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lon));
  L.circleMarker([coords[0].lat,coords[0].lon],{
    radius:6,color:'#fff',weight:2,fillColor:'#2a9b69',fillOpacity:1
  }).addTo(map).bindTooltip('Inicio');
  L.circleMarker([coords.at(-1).lat,coords.at(-1).lon],{
    radius:6,color:'#fff',weight:2,fillColor:'#ee5c73',fillOpacity:1
  }).addTo(map).bindTooltip('Final');
  markers[id]=L.circleMarker([coords[0].lat,coords[0].lon],{
    radius:8,color:'#fff',weight:2,fillColor:'#ff9f43',fillOpacity:0,opacity:0
  }).addTo(map);
  map.fitBounds(route.getBounds(),{padding:[28,28]});
  if(id==='map'){setEngine('OpenStreetMap','Leaflet');setStatus('OpenStreetMap');}
  else setStatus('OpenStreetMap','videoMapStatus');
  if(window.ResizeObserver){
    observers[id]=new ResizeObserver(()=>maps[id]?.invalidateSize());
    observers[id].observe(host);
  }
  setTimeout(()=>maps[id]?.invalidateSize(),100);
}
export function fitRoute(points){
  const map=maps.map;
  if(map&&points?.length){
    const coords=points.filter(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lon));
    if(coords.length)map.fitBounds(window.L.latLngBounds(coords.map(p=>[p.lat,p.lon])),{padding:[28,28]});
  }
}
export function fitVideoRoute(points){
  const map=maps.videoMap;
  if(map&&points?.length){
    map.invalidateSize();
    const coords=points.filter(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lon));
    if(coords.length)map.fitBounds(window.L.latLngBounds(coords.map(p=>[p.lat,p.lon])),{padding:[28,28]});
  }
}
function show(id,p){
  const marker=markers[id];
  if(p&&marker)marker.setLatLng([p.lat,p.lon]).setStyle({opacity:1,fillOpacity:1});
}
export function showPoint(p){show('map',p)}
export function showVideoPoint(p){show('videoMap',p)}
export function hidePoint(){if(markers.map)markers.map.setStyle({opacity:0,fillOpacity:0})}
export function hideVideoPoint(){if(markers.videoMap)markers.videoMap.setStyle({opacity:0,fillOpacity:0})}
export function getCanvas(){return null}
