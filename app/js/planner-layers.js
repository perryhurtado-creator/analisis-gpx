const osm='<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap contributors</a>';
export function addPlannerLayers(map,L){
  const layers={
    'Estándar · OpenStreetMap':L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:osm}),
    'Ciclismo · CyclOSM':L.tileLayer('https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png',{maxZoom:20,attribution:`${osm} · <a href="https://www.cyclosm.org/" target="_blank" rel="noopener">CyclOSM</a> · OpenStreetMap France`}),
    'Humanitaria · HOT':L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',{maxZoom:19,attribution:`${osm} · <a href="https://www.hotosm.org/" target="_blank" rel="noopener">HOT</a> · OpenStreetMap France`})
  };
  Object.values(layers)[0].addTo(map);
  L.control.layers(layers,null,{position:'topright',collapsed:true}).addTo(map);
  const errors=new Set();
  for(const [name,layer] of Object.entries(layers))layer.on('tileerror',()=>{if(map.hasLayer(layer)&&!errors.has(name)){errors.add(name);document.getElementById('plannerLayerStatus').textContent=`No se pudo cargar parte de la capa ${name}. Puedes elegir otra capa.`}});
  map.on('baselayerchange',e=>{document.getElementById('plannerLayerStatus').textContent=`Capa: ${e.name}`});
  return layers;
}
