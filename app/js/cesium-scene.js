import {createVideoScene} from './video-capture.js';
import {routeChunks,terrainSampleIndices,cameraPose} from './cesium-camera.js';
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
export async function createCesiumVideoScene(activity,signal,onStatus=()=>{}){
  let viewer,host,terrainFailed=false;
  const dispose=()=>{if(viewer&&!viewer.isDestroyed())viewer.destroy();host?.remove()};
  const cancel=()=>dispose();signal.addEventListener('abort',cancel,{once:true});
  try{
    onStatus('Cargando CesiumJS…');
    const C=await bounded(loadCesium(),signal,30000,'No se pudo cargar CesiumJS.');check(signal);
    onStatus('Preparando el relieve real del terreno…');
    const terrain=await bounded(C.ArcGISTiledElevationTerrainProvider.fromUrl(TERRAIN_URL,{credit:new C.Credit(TERRAIN_CREDIT)}),signal,30000,'No se pudo cargar el relieve. Revisa tu conexión.');check(signal);
    terrain.errorEvent.addEventListener(()=>{terrainFailed=true});
    host=document.createElement('div');host.className='cesium-render-host';host.setAttribute('aria-hidden','true');document.body.appendChild(host);
    viewer=new C.Viewer(host,{animation:false,timeline:false,baseLayerPicker:false,geocoder:false,homeButton:false,sceneModePicker:false,navigationHelpButton:false,fullscreenButton:false,infoBox:false,selectionIndicator:false,useDefaultRenderLoop:false,orderIndependentTranslucency:false,scene3DOnly:true,terrainProvider:terrain,baseLayer:new C.ImageryLayer(new C.OpenStreetMapImageryProvider({url:'https://tile.openstreetmap.org/'})),contextOptions:{webgl:{preserveDrawingBuffer:true,antialias:false}},skyBox:false,skyAtmosphere:false,shadows:false});
    viewer.scene.highDynamicRange=false;viewer.scene.msaaSamples=1;viewer.scene.postProcessStages.fxaa.enabled=false;
    viewer.scene.globe.maximumScreenSpaceError=6;viewer.scene.globe.enableLighting=false;viewer.scene.screenSpaceCameraController.enableInputs=false;
    viewer.resolutionScale=1;viewer.resize();
    for(const chunk of routeChunks(activity.points))if(chunk.length>1)viewer.entities.add({polyline:{positions:chunk.map(p=>C.Cartesian3.fromDegrees(p.lon,p.lat)),width:5,material:C.Color.fromCssColorString('#2a9b69'),clampToGround:true}});
    const marker=viewer.entities.add({position:C.Cartesian3.fromDegrees(activity.points[0].lon,activity.points[0].lat),point:{pixelSize:15,color:C.Color.fromCssColorString('#ff9f43'),outlineColor:C.Color.WHITE,outlineWidth:2,disableDepthTestDistance:Number.POSITIVE_INFINITY}});
    const indices=terrainSampleIndices(activity.points);
    const samples=await bounded(C.sampleTerrain(terrain,12,indices.map(i=>C.Cartographic.fromDegrees(activity.points[i].lon,activity.points[i].lat))),signal,30000,'No se pudo consultar la altura del terreno.');check(signal);
    if(samples.some(p=>!Number.isFinite(p.height)))throw Error('El servicio no devolvió alturas válidas para esta ruta.');
    const heights=samples.map((p,i)=>({index:indices[i],height:p.height}));
    async function render(progress,timeout=20000){
      check(signal);const pose=cameraPose(activity.points,progress,heights);
      const target=C.Cartesian3.fromDegrees(pose.lon,pose.lat,pose.height);
      marker.position=target;viewer.camera.lookAt(target,new C.HeadingPitchRange(C.Math.toRadians(pose.heading),C.Math.toRadians(pose.pitch),pose.range));viewer.render();
      // Dejar que se soliciten los mosaicos de la nueva vista antes de evaluar tilesLoaded.
      await wait(0,signal);const deadline=performance.now()+timeout;let waited=false;
      while(!viewer.scene.globe.tilesLoaded){
        check(signal);if(terrainFailed)throw Error('Falló la carga del relieve 3D. Revisa tu conexión e inténtalo de nuevo.');
        if(performance.now()>deadline)throw Error('El mapa 3D no terminó de cargar. Prueba otra vez con buena conexión.');
        waited=true;viewer.render();await wait(40,signal);
      }
      check(signal);if(terrainFailed)throw Error('Falló la carga del relieve 3D.');
      if(waited)viewer.render();
    }
    onStatus('Cargando mapa y ruta 3D…');await render(0,60000);
    const overlay=await createVideoScene(activity,signal,{mapSource:{canvas:viewer.canvas},credit:'CesiumJS · © OpenStreetMap contributors · Terreno: Esri y colaboradores'});
    const canvas=document.createElement('canvas');canvas.width=720;canvas.height=1280;
    const ctx=canvas.getContext('2d');if(!ctx)throw Error('No se pudo preparar el video 3D.');
    let disposed=false;
    return {canvas,fps:30,seconds:15,bitrate:5000000,async draw(index,progress){
      await render(progress);overlay.draw(index,progress);ctx.drawImage(overlay.canvas,0,0,720,1280);
      // Las atribuciones del terreno se conservan dentro del archivo exportado.
      ctx.fillStyle='rgba(255,255,255,.9)';ctx.fillRect(10,984,700,68);ctx.fillStyle='#17392c';ctx.font='12px sans-serif';
      const words=TERRAIN_CREDIT.split(' ');let line='',y=1002;
      for(const word of words){if(ctx.measureText(line+word).width>672){ctx.fillText(line,20,y);y+=16;line=''}line+=word+' '}ctx.fillText(line,20,y);
      ctx.getImageData(0,0,1,1);
    },dispose(){if(disposed)return;disposed=true;signal.removeEventListener('abort',cancel);dispose()}};
  }catch(e){signal.removeEventListener('abort',cancel);dispose();throw e}
}
