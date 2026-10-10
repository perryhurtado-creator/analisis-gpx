import {createCesiumVideoScene} from './cesium-scene.js';
import {encodeVideoScene,recordingFormat} from './video-capture.js';
import {completeWebmDuration} from './webm-duration.js';
let current=null;
export function video3DBusy(){return current!==null}
export function stopVideo3D(){current?.abort()}
function download(blob,name,extension){
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=String(name||'ruta').replace(/[^a-z0-9áéíóúñ_-]/gi,'_')+'_3D.'+extension;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
export async function recordScene(scene,points,signal,status){
  const format=recordingFormat();let recorder,stream,rejectRecording,timer;
  const onAbort=()=>{rejectRecording?.(new DOMException('Grabación cancelada.','AbortError'));if(recorder&&recorder.state!=='inactive')recorder.stop()};
  signal.addEventListener('abort',onAbort,{once:true});
  try{
    await scene.draw(0,0);if(signal.aborted)throw new DOMException('Grabación cancelada.','AbortError');
    if(!scene.canvas.captureStream)throw Error('Este navegador no permite grabar la vista 3D.');
    stream=scene.canvas.captureStream(scene.fps);recorder=new MediaRecorder(stream,{mimeType:format.mime,videoBitsPerSecond:scene.bitrate});
    const chunks=[];let elapsed=0;
    const transition=async action=>{
      const event=action==='pause'?'pause':'resume';let listener;
      const changed=new Promise(resolve=>{listener=resolve;recorder.addEventListener(event,listener,{once:true});recorder[action]()});
      try{await Promise.race([changed,stopped.then(()=>{throw Error('La grabación se detuvo antes de terminar.')})])}
      finally{recorder.removeEventListener(event,listener)}
    };
    const stopped=new Promise((resolve,reject)=>{rejectRecording=reject;recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};recorder.onerror=e=>reject(e.error||Error('No se pudo grabar el video 3D.'));recorder.onstop=()=>signal.aborted?reject(new DOMException('Grabación cancelada.','AbortError')):resolve()});
    // Observar errores del recorder también mientras se preparan fotogramas.
    let failure;stopped.catch(e=>{failure=e});
    recorder.start(1000);await transition('pause');timer=setTimeout(()=>{failure=Error('La grabación 3D tardó demasiado.');onAbort()},Math.max(180000,scene.seconds*10000));
    const frames=scene.fps*scene.seconds;
    for(let frame=0;frame<frames;frame++){
      if(signal.aborted)throw new DOMException('Grabación cancelada.','AbortError');if(failure)throw failure;
      const progress=frame/(frames-1),index=Math.floor(progress*(points.length-1));
      // Las esperas de terreno ocurren con la grabación pausada.
      await scene.draw(index,progress);if(signal.aborted)throw new DOMException('Grabación cancelada.','AbortError');if(failure)throw failure;
      await transition('resume');const began=performance.now();stream.getVideoTracks()[0]?.requestFrame?.();status(`Grabando 3D… ${Math.round((frame+1)/frames*100)} %`);
      await new Promise(resolve=>setTimeout(resolve,1000/scene.fps));elapsed+=performance.now()-began;
      if(signal.aborted)throw new DOMException('Grabación cancelada.','AbortError');if(failure)throw failure;await transition('pause');
    }
    if(recorder.state!=='inactive')recorder.stop();await stopped;
    let blob=new Blob(chunks,{type:recorder.mimeType||format.mime});if(blob.size<1024)throw Error('La grabación 3D quedó vacía.');
    if(format.extension==='webm')blob=await completeWebmDuration(blob,elapsed);
    return {blob,extension:format.extension};
  }finally{clearTimeout(timer);signal.removeEventListener('abort',onAbort);if(recorder&&recorder.state!=='inactive')recorder.stop();stream?.getTracks().forEach(t=>t.stop())}
}
async function run(activity,exportVideo){
  if(current||!activity?.points?.length)return;
  const controller=new AbortController(),state=document.getElementById('videoState'),host=document.getElementById('video3DPreview');
  const options={cameraStyle:document.getElementById('video3DStyle')?.value||'aerial',showLocalities:document.getElementById('videoLocalities')?.checked??false};
  const buttons=['playRoute','makeVideo','videoMode','video3DStyle','videoLocalities'].map(id=>document.getElementById(id));
  let scene;current=controller;buttons.forEach(b=>{if(b)b.disabled=true});
  const status=text=>{state.textContent=text},hidden=()=>{if(document.hidden)controller.abort()};document.addEventListener('visibilitychange',hidden);
  try{
    host.replaceChildren();scene=await createCesiumVideoScene(activity,controller.signal,status,options);if(controller.signal.aborted)throw new DOMException('Grabación cancelada.','AbortError');
    scene.canvas.setAttribute('aria-label',options.cameraStyle==='cinematic'?'Vuelo cinematográfico sobre relieve e imágenes satelitales':'Video aéreo 3D con altimetría, velocidad y distancia');host.appendChild(scene.canvas);
    scene.canvas.classList.toggle('cinematic-video',options.cameraStyle==='cinematic');
    if(exportVideo){
      let result;
      if(typeof VideoEncoder==='function'){
        try{result=await encodeVideoScene(scene,activity,controller.signal,(_,percent,extension)=>status(`Generando 3D ${extension.toUpperCase()}… ${percent} %`))}
        catch(e){if(controller.signal.aborted||e.name==='AbortError')throw e;status('Preparando grabación 3D compatible con este navegador…')}
      }
      if(!result)result=await recordScene(scene,activity.points,controller.signal,status);
      if(controller.signal.aborted)throw new DOMException('Grabación cancelada.','AbortError');
      download(result.blob,activity.name,result.extension);status(`Video 3D ${result.extension.toUpperCase()} descargado en 720p. ${scene.localityNote||''}`);
    }else{
      const frames=scene.fps*scene.seconds;
      for(let frame=0;frame<frames;frame++){
        if(controller.signal.aborted)throw new DOMException('Grabación cancelada.','AbortError');
        const began=performance.now(),progress=frame/(frames-1);await scene.draw(Math.floor(progress*(activity.points.length-1)),progress);
        status(`Reproduciendo vista aérea 3D… ${Math.round(progress*100)} %`);await new Promise(resolve=>setTimeout(resolve,Math.max(0,1000/scene.fps-(performance.now()-began))));
      }
      status(`Vista aérea terminada. Pulsa Guardar vídeo para exportarla. ${scene.localityNote||''}`);
    }
  }catch(e){status(e.name==='AbortError'?'Video 3D cancelado. Puedes volver a intentarlo.':`No se pudo generar el video 3D: ${e.message||'error desconocido'}`)}
  finally{scene?.dispose();controller.abort();document.removeEventListener('visibilitychange',hidden);if(current===controller)current=null;buttons.forEach(b=>{if(b)b.disabled=false})}
}
export function playVideo3D(activity){return run(activity,false)}
export function makeVideo3D(activity){return run(activity,true)}
