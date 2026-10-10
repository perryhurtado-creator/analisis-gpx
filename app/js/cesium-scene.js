import {createVideoScene} from './video-capture.js';
import {routeChunks,terrainSampleIndices,cameraPose,cinematicBounds,cinematicCameraPose,droneCameraPose} from './cesium-camera.js';
import {loadRouteLocalities,visibleLocalities} from './video-localities.js';
import {sampleVideoPoint} from './video-capture.js';
const CESIUM_BASE='https://cesium.com/downloads/cesiumjs/releases/1.124/Build/Cesium/';
const TERRAIN_URL='https://elevation3d.arcgis.com/arcgis/rest/services/WorldElevation3D/Terrain3D/ImageServer';
const TERRAIN_CREDIT='Sources: Vantor, Airbus DS, USGS, NGA, NASA, CGIAR, GEBCO, N Robinson, NCEAS, NLS, OS, NMA, Geodatastyrelsen and the GIS User Community';
let loading;
const aborted=()=>new DOMException('Grabación cancelada.','AbortError');
function check(signal){if(signal.aborted)throw aborted()}
export async function loadCesium(){
  if(window.Cesium)return window.Cesium;
  if(!loading)loading=new Promise((resolve,reject)=>{
    window.CESIUM_BASE_URL=CESIUM_BASE;
    const style=document.createElement('link');style.rel='stylesheet';style.href=CESIUM_BASE+'Widgets/widgets.css';document.head.appendChild(style);
    const script=document.createElement('script');script.src=CESIUM_BASE+'Cesium.js';script.async=true;
    const timer=setTimeout(()=>{script.remove();reject(Error('No se pudo cargar CesiumJS. Revisa tu conexión.'))},30000);
    script.onload=()=>{clearTimeout(timer);window.Cesium?resolve(window.Cesium):reject(Error('CesiumJS no está disponible.'))};
    script.onerror=()=>{clearTimeout(timer);script.remove();reject(Error('No se pudo cargar la vista 3D. Revisa tu conexión.'))};
    document.head.appendChild(script);
  }).catch(e=>{loading=null;throw e});
  return loading;
}
function bounded(promise,signal,ms,message){
  return new Promise((resolve,reject)=>{
    const onAbort=()=>finish(aborted()),timer=setTimeout(()=>finish(Error(message)),ms);
    function finish(error,value){clearTimeout(timer);signal.removeEventListener('abort',onAbort);error?reject(error):resolve(value)}
    signal.addEventListener('abort',onAbort,{once:true});
    if(signal.aborted){onAbort();return}
    promise.then(value=>finish(null,value),finish);
  });
}
function wait(ms,signal){return bounded(new Promise(resolve=>setTimeout(resolve,ms)),signal,ms+1000,'La vista 3D no respondió.');}
export async function createCesiumVideoScene(activity,signal,onStatus=()=>{},options={}){
  let viewer,host,terrainFailed=false,imageryFailed=false;
  const following=options.cameraStyle==='drone',cinematic=following||options.cameraStyle==='cinematic',bounds=cinematicBounds(activity.points);
  let places=[],localityNote='';
  const dispose=()=>{if(viewer&&!viewer.isDestroyed())viewer.destroy();host?.remove()};
  const cancel=()=>dispose();signal.addEventListener('abort',cancel,{once:true});
  try{
    onStatus('Cargando CesiumJS…');
    const C=await bounded(loadCesium(),signal,30000,'No se pudo cargar CesiumJS.');check(signal);
    onStatus('Preparando el relieve real del terreno…');
    const terrain=await bounded(C.ArcGISTiledElevationTerrainProvider.fromUrl(TERRAIN_URL,{credit:new C.Credit(TERRAIN_CREDIT)}),signal,30000,'No se pudo cargar el relieve. Revisa tu conexión.');check(signal);
    terrain.errorEvent.addEventListener(()=>{terrainFailed=true});
    host=document.createElement('div');host.className='cesium-render-host';host.setAttribute('aria-hidden','true');if(cinematic){host.style.width='1280px';host.style.height='580px'}document.body.appendChild(host);
    const imagery=cinematic?await bounded(C.ArcGisMapServerImageryProvider.fromUrl('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer'),signal,30000,'No se pudieron cargar las imágenes satelitales.'):new C.OpenStreetMapImageryProvider({url:'https://tile.openstreetmap.org/'});check(signal);
    imagery.errorEvent.addEventListener(()=>{imageryFailed=true});
    viewer=new C.Viewer(host,{animation:false,timeline:false,baseLayerPicker:false,geocoder:false,homeButton:false,sceneModePicker:false,navigationHelpButton:false,fullscreenButton:false,infoBox:false,selectionIndicator:false,useDefaultRenderLoop:false,orderIndependentTranslucency:false,scene3DOnly:true,terrainProvider:terrain,baseLayer:new C.ImageryLayer(imagery),contextOptions:{webgl:{preserveDrawingBuffer:true,antialias:false}},skyBox:false,skyAtmosphere:false,shadows:false});
    viewer.scene.highDynamicRange=false;viewer.scene.msaaSamples=1;viewer.scene.postProcessStages.fxaa.enabled=false;
    viewer.scene.globe.maximumScreenSpaceError=cinematic?4:6;viewer.scene.globe.tileCacheSize=400;viewer.scene.globe.enableLighting=false;viewer.scene.screenSpaceCameraController.enableInputs=false;
    viewer.resolutionScale=1;viewer.resize();
    for(const chunk of routeChunks(activity.points))if(chunk.length>1)viewer.entities.add({polyline:{positions:chunk.map(p=>C.Cartesian3.fromDegrees(p.lon,p.lat)),width:5,material:C.Color.fromCssColorString(cinematic?'#ff6b27':'#2a9b69'),clampToGround:true}});
    const marker=viewer.entities.add({position:C.Cartesian3.fromDegrees(activity.points[0].lon,activity.points[0].lat),point:{pixelSize:15,color:C.Color.fromCssColorString('#ff9f43'),outlineColor:C.Color.WHITE,outlineWidth:2,disableDepthTestDistance:Number.POSITIVE_INFINITY}});
    const indices=terrainSampleIndices(activity.points);
    if(options.showLocalities){
      onStatus('Consultando pueblos cercanos al recorrido…');
      try{places=await bounded(loadRouteLocalities(activity.points,signal),signal,40000,'La consulta de localidades tardó demasiado.');localityNote=places.length?`${places.length} ${places.length===1?'localidad cercana identificada':'localidades cercanas identificadas'}.`:'No se encontraron localidades cercanas en OpenStreetMap.'}
      catch(e){check(signal);localityNote='No se pudieron cargar los nombres de localidades; el video se generó sin ellos.';onStatus(localityNote)}
    }
    const samples=await bounded(C.sampleTerrain(terrain,12,indices.map(i=>C.Cartographic.fromDegrees(activity.points[i].lon,activity.points[i].lat))),signal,30000,'No se pudo consultar la altura del terreno.');check(signal);
    if(samples.some(p=>!Number.isFinite(p.height)))throw Error('El servicio no devolvió alturas válidas para esta ruta.');
    const heights=samples.map((p,i)=>({index:indices[i],height:p.height}));
    let labels=[];
    if(places.length){
      try{
        const ground=await bounded(C.sampleTerrain(terrain,12,places.map(p=>C.Cartographic.fromDegrees(p.lon,p.lat))),signal,30000,'No se pudieron ubicar las localidades sobre el terreno.');check(signal);
        labels=places.map((p,i)=>Number.isFinite(ground[i].height)?viewer.entities.add({show:false,position:C.Cartesian3.fromDegrees(p.lon,p.lat,ground[i].height+25),point:{pixelSize:5,color:C.Color.WHITE,disableDepthTestDistance:Infinity},label:{text:p.name,font:cinematic?'30px sans-serif':'24px sans-serif',style:C.LabelStyle.FILL_AND_OUTLINE,fillColor:C.Color.WHITE,outlineColor:C.Color.BLACK,outlineWidth:2,showBackground:true,backgroundColor:new C.Color(.03,.06,.09,.75),backgroundPadding:new C.Cartesian2(9,5),pixelOffset:new C.Cartesian2(0,-23),verticalOrigin:C.VerticalOrigin.BOTTOM,disableDepthTestDistance:Infinity}}):null);
        if(labels.every(label=>!label))localityNote='No se pudieron ubicar los pueblos en el relieve; el video se generó sin nombres.';
      }catch(e){check(signal);localityNote='No se pudieron ubicar los pueblos en el relieve; el video se generó sin nombres.'}
    }
    async function render(progress,timeout=20000){
      check(signal);const pose=following?droneCameraPose(activity.points,progress,heights,bounds):cinematic?cinematicCameraPose(activity.points,progress,heights,bounds):cameraPose(activity.points,progress,heights);
      const target=C.Cartesian3.fromDegrees(pose.lon,pose.lat,pose.height);
      const trackPose=cameraPose(activity.points,pose.trackProgress??progress,heights);marker.position=C.Cartesian3.fromDegrees(trackPose.lon,trackPose.lat,trackPose.height);
      viewer.camera.lookAt(target,new C.HeadingPitchRange(C.Math.toRadians(pose.heading),C.Math.toRadians(pose.pitch),pose.range));
      labels.forEach(label=>{if(label)label.show=false});
      const distance=sampleVideoPoint(activity.points,pose.trackProgress??progress).point.d||0,total=activity.points.at(-1).d||1,occupied=[];
      for(const item of visibleLocalities(places,distance,total)){
        const entity=labels[item.index];if(!entity)continue;
        const fade=cinematic?Math.max(0,Math.min(1,(progress-.10)/.04,(.92-progress)/.06)):1,alpha=item.alpha*fade;if(alpha<.02)continue;
        const screen=C.SceneTransforms.worldToWindowCoordinates(viewer.scene,entity.position.getValue(viewer.clock.currentTime));
        if(!screen||screen.x<60||screen.x>viewer.canvas.clientWidth-60||screen.y<65||screen.y>viewer.canvas.clientHeight-30)continue;
        const width=places[item.index].name.length*(cinematic?18:14),box=[screen.x-width/2,screen.y-62,screen.x+width/2,screen.y];
        if(occupied.some(b=>!(box[2]<b[0]||box[0]>b[2]||box[3]<b[1]||box[1]>b[3])))continue;
        occupied.push(box);entity.show=true;entity.label.fillColor=C.Color.WHITE.withAlpha(alpha);entity.label.outlineColor=C.Color.BLACK.withAlpha(alpha);entity.label.backgroundColor=new C.Color(.03,.06,.09,.75*alpha);entity.point.color=C.Color.WHITE.withAlpha(alpha);
      }
      viewer.render();
      // Dejar que se soliciten los mosaicos de la nueva vista antes de evaluar tilesLoaded.
      await wait(0,signal);const deadline=performance.now()+timeout;let waited=false;
      while(!viewer.scene.globe.tilesLoaded){
        check(signal);if(terrainFailed)throw Error('Falló la carga del relieve 3D. Revisa tu conexión e inténtalo de nuevo.');
        if(imageryFailed)throw Error('Falló la carga de las imágenes del mapa 3D. Revisa tu conexión e inténtalo de nuevo.');
        if(performance.now()>deadline)throw Error('El mapa 3D no terminó de cargar. Prueba otra vez con buena conexión.');
        waited=true;viewer.render();await wait(40,signal);
      }
      check(signal);if(terrainFailed)throw Error('Falló la carga del relieve 3D.');
      if(imageryFailed)throw Error('Falló la carga de las imágenes del mapa 3D.');
      if(waited)viewer.render();
    }
    onStatus('Cargando mapa y ruta 3D…');await render(0,60000);
    if(cinematic){for(const progress of (following?[.14,.32,.5,.68,.80,.88,.95]:[.14,.95])){onStatus(`Preparando relieve e imágenes del vuelo… ${Math.round(progress*100)} %`);await render(progress,60000)}await render(0,60000)}
    if(cinematic){
      const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=720;const ctx=canvas.getContext('2d');if(!ctx)throw Error('No se pudo preparar el video.');
      const logo=new Image();logo.src=new URL('../assets/logo-perros-en-bicicleta.png',import.meta.url).href;
      await bounded(new Promise((resolve,reject)=>{if(logo.complete&&logo.naturalWidth)resolve();else{logo.onload=resolve;logo.onerror=()=>reject(Error('No se pudo cargar el logo.'))}}),signal,10000,'No se pudo cargar el logo.');
      return {canvas,fps:24,seconds:40,bitrate:7000000,localityNote,async draw(index,progress){
        await render(progress);ctx.fillStyle='#0c1217';ctx.fillRect(0,0,1280,720);ctx.drawImage(viewer.canvas,0,68,1280,580);
        ctx.fillStyle='#fff';ctx.font='bold 30px sans-serif';let name=String(activity.name||'Ruta').replace(/,/g,' ·');const fullName=name;while(ctx.measureText(name).width>1080&&name.length>1)name=name.slice(0,-1);if(name!==fullName)name=name.trimEnd()+'…';ctx.fillText(name,24,43);
        const h=58,w=h*logo.naturalWidth/logo.naturalHeight;ctx.drawImage(logo,1256-w,5,w,h);
        ctx.font='13px sans-serif';ctx.fillStyle='#d3dde4';ctx.fillText('Vuelo virtual · Relieve real · © OpenStreetMap · Imágenes: Esri, Vantor, Earthstar Geographics y GIS User Community',24,669);
        ctx.font='10px sans-serif';let line='',y=687;for(const word of TERRAIN_CREDIT.split(' ')){if(ctx.measureText(line+word).width>1230){ctx.fillText(line,24,y);y+=13;line=''}line+=word+' '}ctx.fillText(line,24,y);ctx.getImageData(0,0,1,1);
      },dispose(){signal.removeEventListener('abort',cancel);dispose()}};
    }
    const overlay=await createVideoScene(activity,signal,{mapSource:{canvas:viewer.canvas},credit:'CesiumJS · © OpenStreetMap contributors · Terreno: Esri y colaboradores'});
    const canvas=document.createElement('canvas');canvas.width=720;canvas.height=1280;
    const ctx=canvas.getContext('2d');if(!ctx)throw Error('No se pudo preparar el video 3D.');
    let disposed=false;
    return {canvas,fps:30,seconds:15,bitrate:5000000,localityNote,async draw(index,progress){
      await render(progress);overlay.draw(index,progress);ctx.drawImage(overlay.canvas,0,0,720,1280);
      // Las atribuciones del terreno se conservan dentro del archivo exportado.
      ctx.fillStyle='rgba(255,255,255,.9)';ctx.fillRect(10,984,700,68);ctx.fillStyle='#17392c';ctx.font='12px sans-serif';
      const words=TERRAIN_CREDIT.split(' ');let line='',y=1002;
      for(const word of words){if(ctx.measureText(line+word).width>672){ctx.fillText(line,20,y);y+=16;line=''}line+=word+' '}ctx.fillText(line,20,y);
      ctx.getImageData(0,0,1,1);
    },dispose(){if(disposed)return;disposed=true;signal.removeEventListener('abort',cancel);dispose()}};
  }catch(e){signal.removeEventListener('abort',cancel);dispose();throw e}
}
