let map=null,leaflet=null,routeMarker=null,leafletMarker=null,mapKind='',resizeObserver=null;

const engineEl=()=>document.getElementById('engine');
export function getMapState(){return {map,leaflet,mapKind}};
function setEngine(main,fallback=''){if(engineEl())engineEl().innerHTML=`<span class="tag">${main}</span>${fallback?`<span class="tag fallback">${fallback}</span>`:''}`}
function setStatus(t){document.getElementById('mapStatus').textContent=t}
function pointFeature(p,name){return{type:'Feature',properties:{name},geometry:{type:'Point',coordinates:[p.lon,p.lat]}}}

export function clearMap(){
  if(map){map.remove();map=null}
  if(leaflet){leaflet.remove();leaflet=null}
  routeMarker=null;leafletMarker=null;document.getElementById('map').innerHTML='';
}
export function createMap(points){
  clearMap();
  const token=localStorage.getItem('pb-mapbox-token')||'';
  if(token&&window.mapboxgl){
    try{
      mapboxgl.accessToken=token;
      map=new mapboxgl.Map({container:'map',style:'mapbox://styles/mapbox/outdoors-v12',center:[points[0].lon,points[0].lat],zoom:12,attributionControl:true,preserveDrawingBuffer:true});
      map.addControl(new mapboxgl.NavigationControl(),'top-right');
      map.on('load',()=>{
        const geo={type:'Feature',properties:{},geometry:{type:'LineString',coordinates:points.map(p=>[p.lon,p.lat])}};
        map.addSource('route',{type:'geojson',data:geo});
        map.addLayer({id:'route-shadow',type:'line',source:'route',paint:{'line-color':'#143d31','line-width':8,'line-opacity':.25}});
        map.addLayer({id:'route-line',type:'line',source:'route',paint:{'line-color':'#cdf45a','line-width':4}});
        map.addSource('ends',{type:'geojson',data:{type:'FeatureCollection',features:[pointFeature(points[0],'Inicio'),pointFeature(points.at(-1),'Final')]}});
        map.addLayer({id:'ends',type:'circle',source:'ends',paint:{'circle-radius':6,'circle-color':['match',['get','name'],'Inicio','#cdf45a','#ee5c73'],'circle-stroke-width':2,'circle-stroke-color':'#fff'}});
        routeMarker=new mapboxgl.Marker({color:'#ff9f43'}).setLngLat([points[0].lon,points[0].lat]).addTo(map);
        routeMarker.getElement().style.opacity='0';
        fitRoute(points);setEngine('Mapbox','Outdoor');setStatus('Mapbox · Outdoor');
      });
      map.on('error',e=>{console.warn('Mapbox',e.error);if(mapKind==='fallback')return;createFallback(points,'Error de Mapbox')});
      mapKind='mapbox';return;
    }catch(e){console.warn(e)}
  }
  createFallback(points,token?'No se pudo iniciar Mapbox':'Configura tu token de Mapbox');
}
function createFallback(points,reason){
  clearMap();mapKind='fallback';
  if(!window.L){document.getElementById('map').innerHTML=`<div class="map-placeholder"><div><b>Mapa listo para configurar</b>${reason}.</div></div>`;setEngine('Sin mapa',reason);return}
  leaflet=L.map('map',{zoomControl:true,attributionControl:true});
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(leaflet);
  const line=L.polyline(points.map(p=>[p.lat,p.lon]),{color:'#2a9b69',weight:5,opacity:.9}).addTo(leaflet);
  L.circleMarker([points[0].lat,points[0].lon],{radius:6,color:'#fff',weight:2,fillColor:'#2a9b69',fillOpacity:1}).addTo(leaflet).bindTooltip('Inicio');
  L.circleMarker([points.at(-1).lat,points.at(-1).lon],{radius:6,color:'#fff',weight:2,fillColor:'#ee5c73',fillOpacity:1}).addTo(leaflet).bindTooltip('Final');
  leafletMarker=L.circleMarker([points[0].lat,points[0].lon],{radius:7,color:'#fff',weight:2,fillColor:'#ff9f43',fillOpacity:0,opacity:0}).addTo(leaflet);
  leaflet.fitBounds(line.getBounds(),{padding:[28,28]});setEngine('Mapa de respaldo','OpenStreetMap');setStatus(reason);
  if(!resizeObserver){resizeObserver=new ResizeObserver(()=>leaflet&&leaflet.invalidateSize());resizeObserver.observe(document.getElementById('map'))}
}
export function fitRoute(points){
  if(map){const b=new mapboxgl.LngLatBounds();points.forEach(p=>b.extend([p.lon,p.lat]));map.fitBounds(b,{padding:45,maxZoom:15,duration:600})}
  else if(leaflet)leaflet.fitBounds(L.latLngBounds(points.map(p=>[p.lat,p.lon])),{padding:[28,28]});
}
export function showPoint(p){
  if(!p)return;
  if(map&&routeMarker){routeMarker.setLngLat([p.lon,p.lat]);routeMarker.getElement().style.opacity='1'}
  if(leaflet&&leafletMarker)leafletMarker.setLatLng([p.lat,p.lon]).setStyle({opacity:1,fillOpacity:1});
}
export function hidePoint(){
  if(routeMarker)routeMarker.getElement().style.opacity='0';
  if(leafletMarker)leafletMarker.setStyle({opacity:0,fillOpacity:0});
}
export function getCanvas(){return map&&mapKind==='mapbox'?map.getCanvas():null}
