const maps={map:null,videoMap:null};
const markers={map:null,videoMap:null};
const observers={};
function engineEl(){return document.getElementById('engine')}
function setEngine(main,fallback=''){const el=engineEl();if(el)el.innerHTML='<span class="tag">'+main+'</span>'+(fallback?'<span class="tag fallback">'+fallback+'</span>':'')}
function setStatus(text,id='mapStatus'){const el=document.getElementById(id);if(el)el.textContent=text}
function destroyMap(id){if(maps[id]){maps[id].remove();maps[id]=null}markers[id]=null;if(observers[id]){observers[id].disconnect();delete observers[id]}const host=document.getElementById(id);if(host)host.innerHTML=''}
export function clearMap(){destroyMap('map')}
export function createMap(points,id='map'){
  destroyMap(id);
  const host=document.getElementById(id),L=window.L;
  if(!host||!Array.isArray(points)||points.length<2||!L)return;
  const map=L.map(host,{zoomControl:true,attributionControl:true});maps[id]=map;
  // Inicializar la vista antes de añadir paths: Leaflet necesita los límites
  // del renderer para proyectar y recortar las líneas.
  map.fitBounds(L.latLngBounds(points.map(p=>[p.lat,p.lon])),{padding:[28,28]});
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap contributors'}).addTo(map);
  const chunks=[];
  let previous=null;
  for(const p of points){
    if(!chunks.length||p.breakBefore||p.segmentId!==previous.segmentId)chunks.push([]);
    chunks[chunks.length-1].push([p.lat,p.lon]);
    previous=p;
  }
  const lines=chunks.filter(chunk=>chunk.length>=2).map(chunk=>L.polyline(chunk,{color:'#2a9b69',weight:5,opacity:.9}));
  const routeLayer=L.featureGroup(lines).addTo(map);
  if(lines.length){
    const first=points[0],last=points.at(-1);
    L.circleMarker([first.lat,first.lon],{radius:6,color:'#fff',weight:2,fillColor:'#2a9b69',fillOpacity:1}).addTo(map).bindTooltip('Inicio');
    L.circleMarker([last.lat,last.lon],{radius:6,color:'#fff',weight:2,fillColor:'#ee5c73',fillOpacity:1}).addTo(map).bindTooltip('Final');
    markers[id]=L.circleMarker([first.lat,first.lon],{radius:8,color:'#fff',weight:2,fillColor:'#ff9f43',fillOpacity:0,opacity:0}).addTo(map);
  }
  if(id==='map'){setEngine('OpenStreetMap','Leaflet');setStatus('OpenStreetMap')}else setStatus('OpenStreetMap','videoMapStatus');
  if(window.ResizeObserver){observers[id]=new ResizeObserver(()=>maps[id]?.invalidateSize());observers[id].observe(host)}
  setTimeout(()=>maps[id]?.invalidateSize(),100)
}
export function fitRoute(points){const map=maps.map;if(map&&points?.length)map.fitBounds(window.L.latLngBounds(points.map(p=>[p.lat,p.lon])),{padding:[28,28]})}
export function fitVideoRoute(points){const map=maps.videoMap;if(map&&points?.length){map.invalidateSize();map.fitBounds(window.L.latLngBounds(points.map(p=>[p.lat,p.lon])),{padding:[28,28]})}}
function show(id,p){const marker=markers[id];if(p&&marker)marker.setLatLng([p.lat,p.lon]).setStyle({opacity:1,fillOpacity:1})}
export function showPoint(p){show('map',p)}
export function showVideoPoint(p){show('videoMap',p)}
export function hidePoint(){if(markers.map)markers.map.setStyle({opacity:0,fillOpacity:0})}
export function hideVideoPoint(){if(markers.videoMap)markers.videoMap.setStyle({opacity:0,fillOpacity:0})}
export function videoMapSnapshot(points){
  const map=maps.videoMap;
  if(!map)throw Error('Carga la ruta en el mapa antes de guardar el vídeo.');
  const size=map.getSize(),zoom=map.getZoom(),bounds=map.getPixelBounds();
  if(size.x<=0||size.y<=0)throw Error('Abre la página Generar vídeo para guardar el recorrido.');
  const tiles=[],count=2**zoom;
  for(let y=Math.floor(bounds.min.y/256);y<=Math.floor((bounds.max.y-1)/256);y++){
    if(y<0||y>=count)continue;
    for(let x=Math.floor(bounds.min.x/256);x<=Math.floor((bounds.max.x-1)/256);x++){
      tiles.push({url:`https://tile.openstreetmap.org/${zoom}/${((x%count)+count)%count}/${y}.png`,x:x*256-bounds.min.x,y:y*256-bounds.min.y});
    }
  }
  return {width:size.x,height:size.y,tiles,positions:points.map(p=>{
    const pixel=map.project([p.lat,p.lon],zoom);
    return {x:pixel.x-bounds.min.x,y:pixel.y-bounds.min.y};
  })};
}
