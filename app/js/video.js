import {showVideoFrame,createMap,fitVideoRoute} from './map.js';
import {fmt} from './metrics.js';
import {createVideoScene,recordingFormat,encodeVideoScene} from './video-capture.js';
import {createVideoTimeline,videoSettings} from './video-timeline.js';

let playFrame=null,videoPoints=[],profileState={ele:null,speed:null},capture=null;
export function stopRouteAnimation(){if(playFrame)cancelAnimationFrame(playFrame);playFrame=null;if(capture)capture.cancel();}
function readSettings(){
  const options=videoSettings({duration:document.getElementById('videoDuration')?.value??9,mode:document.getElementById('videoMode')?.value,tailSeconds:document.getElementById('videoTail')?.value??2});
  const input=document.getElementById('videoDuration');if(input)input.value=options.duration;
  return options;
}
function timingNote(timeline){
  const note=document.getElementById('videoTimingNote');if(!note)return;
  const fallback=timeline.requestedMode==='time'&&timeline.mode!=='time'?'Este archivo no tiene tiempos completos y ordenados. ':'';
  note.textContent=fallback+(timeline.mode==='time'?'Avance por tiempo: conserva las pausas del archivo.':timeline.mode==='distance'?'Avance por distancia: movimiento uniforme.':'Ruta sin distancia acumulada: avance por puntos.')+` Reproducción y vídeo: ${timeline.duration} segundos.`;
}
function updateFrame(timeline,sample){
  showVideoFrame(videoPoints,sample,timeline.tailSeconds>0?timeline.trailStart(sample):null);
  updateProfile('ele',sample);updateProfile('speed',sample);
}
for(const id of ['videoDuration','videoMode','videoTail'])document.getElementById(id)?.addEventListener('change',()=>{
  stopRouteAnimation();
  if(videoPoints.length){const timeline=createVideoTimeline(videoPoints,readSettings());timingNote(timeline);updateFrame(timeline,timeline.at(0))}
  const state=document.getElementById('videoState');if(state)state.textContent='Configuración lista. Vuelve a reproducir para verla.';
  const button=document.getElementById('playRoute');if(button)button.textContent='▷ Reproducir ruta';
});
function drawProfile(id,points,field,label,unit){
  const host=document.getElementById(id);
  profileState[field]=null;
  if(!host||!points?.length)return;
  const values=points.map(p=>p[field]).filter(Number.isFinite);
  if(!values.length){host.innerHTML='<div class="chart-empty">Este archivo no incluye este dato.</div>';return}
  const W=900,H=240,p={l:48,r:15,t:15,b:28},rawMin=Math.min(...values),rawMax=Math.max(...values),pad=Math.max(1,(rawMax-rawMin)*.12),lo=rawMin-pad,hi=rawMax+pad,xMax=Math.max(...points.map(x=>Number(x.d)||0))/1000||1;
  const x=v=>p.l+v/xMax*(W-p.l-p.r),y=v=>H-p.b-(v-lo)/(hi-lo)*(H-p.t-p.b);
  const runs=[];
  let run=[];
  for(let i=0;i<points.length;i++){
    const pt=points[i];
    if(pt.breakBefore||(i>0&&pt.segmentId!==points[i-1].segmentId)||!Number.isFinite(pt[field])){
      if(run.length)runs.push(run);
      run=[];
    }
    if(Number.isFinite(pt[field]))run.push([x(pt.d/1000),y(pt[field])]);
  }
  if(run.length)runs.push(run);
  const pathFor=run=>run.map((v,i)=>(i?'L':'M')+v[0].toFixed(1)+' '+v[1].toFixed(1)).join('');
  const path=runs.map(pathFor).join(' ');
  const area=runs.filter(run=>run.length>1).map(run=>pathFor(run)+` L ${run.at(-1)[0]} ${H-p.b} L ${run[0][0]} ${H-p.b} Z`).join(' ');
  host.innerHTML=`<div class="video-chart-head"><span>${label}</span><b id="${id}Value">—</b></div><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-label="${label}"><defs><linearGradient id="vg-${id}" x1="0" x2="0" y1="0" y2="1"><stop class="video-grad-start" offset="0"/><stop class="video-grad-end" offset="1"/></linearGradient></defs><line x1="${p.l}" x2="${W-p.r}" y1="${p.t}" y2="${p.t}" stroke="#e5eae6"/><line x1="${p.l}" x2="${W-p.r}" y1="${H-p.b}" y2="${H-p.b}" stroke="#e5eae6"/><path class="video-chart-area" d="${area}" fill="url(#vg-${id})"/><path class="video-chart-line" d="${path}"/><line class="video-chart-cursor" id="${id}Cursor" x1="${p.l}" x2="${p.l}" y1="${p.t}" y2="${H-p.b}"/><circle class="video-chart-dot" id="${id}Dot" cx="${p.l}" cy="${H-p.b}" r="4"/><text class="video-chart-readout" id="${id}Readout" x="${p.l+7}" y="${p.t+14}">—</text><text x="2" y="${p.t+6}" font-size="11" fill="#718178">${fmt(hi)}</text><text x="2" y="${H-p.b}" font-size="11" fill="#718178">${fmt(lo)}</text><text x="${p.l}" y="${H-6}" font-size="11" fill="#718178">0 km</text><text x="${W-55}" y="${H-6}" font-size="11" fill="#718178">${fmt(xMax)} km</text></svg>`;
  profileState[field]={id,x,y,unit};
}
function updateProfile(field,sample){
  const state=profileState[field],points=videoPoints;
  if(!state||!points.length)return;
  const p=typeof sample==='number'?points[Math.max(0,Math.min(points.length-1,sample))]:sample.point,value=p[field];
  const cursor=document.getElementById(`${state.id}Cursor`);
  const valueEl=document.getElementById(`${state.id}Value`);
  const coord=[state.x(p.d/1000),Number.isFinite(value)?state.y(value):null];
  if(cursor&&coord){cursor.setAttribute('x1',coord[0]);cursor.setAttribute('x2',coord[0])}
  const dot=document.getElementById(`${state.id}Dot`);
  if(dot){dot.setAttribute('visibility',Number.isFinite(value)&&coord?'visible':'hidden');if(Number.isFinite(value)&&coord){dot.setAttribute('cx',coord[0]);dot.setAttribute('cy',coord[1])}}
  const read=document.getElementById(`${state.id}Readout`);
  const text=Number.isFinite(value)?(field==='ele'?Math.round(value)+' m':value.toFixed(1)+' km/h'):'—';
  if(valueEl)valueEl.textContent=text;
  if(read){read.textContent=text;if(coord)read.setAttribute('x',Math.min(750,coord[0]+7))}
}
export function prepareVideoMap(points){
  stopRouteAnimation();
  if(points?.length){
    videoPoints=points;
    createMap(points,'videoMap');
    fitVideoRoute(points);
    profileState={ele:null,speed:null};
    drawProfile('videoElevationChart',points,'ele','Altimetría','m');
    drawProfile('videoSpeedChart',points,'speed','Velocidad','km/h');
    const timeline=createVideoTimeline(points,readSettings());timingNote(timeline);updateFrame(timeline,timeline.at(0));
  }
}
export function playRoute(points,onDone=()=>{},onFrame=()=>{},timeline=null,startTime=null){
  if(!points?.length)return;
  if(videoPoints!==points)prepareVideoMap(points);
  timeline=timeline||createVideoTimeline(points,readSettings());timingNote(timeline);
  const state=document.getElementById('videoState'),button=document.getElementById('playRoute');
  state.textContent='Reproduciendo ruta…';button.textContent='↻ Reiniciar';
  if(playFrame)cancelAnimationFrame(playFrame);
  const initial=timeline.at(0);updateFrame(timeline,initial);onFrame(initial);
  const start=startTime??performance.now(),total=timeline.duration*1000;
  function step(now){
    const ratio=Math.max(0,Math.min(1,(now-start)/total)),sample=timeline.at(ratio);
    updateFrame(timeline,sample);onFrame(sample);
    if(ratio<1)playFrame=requestAnimationFrame(step);
    else{state.textContent='Reproducción terminada.';button.textContent='▷ Reproducir';playFrame=null;onDone()}
  }
  playFrame=requestAnimationFrame(step);
}
function download(blob,name,extension){
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=(name||'ruta').replace(/[^a-z0-9áéíóúñ_-]/gi,'_')+'.'+extension;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),5000);
}
export async function makeVideo(activity,webmOnly=false){
  if(capture||!activity?.points?.length)return;
  const state=document.getElementById('videoState');
  if(location.protocol==='file:'){state.textContent='Para guardar el vídeo abre la app desde su dirección web o con INICIAR_APP.bat.';return}
  stopRouteAnimation();
  if(videoPoints!==activity.points)prepareVideoMap(activity.points);
  const options=readSettings();
  const controller=new AbortController(),buttons=['playRoute','makeVideo','videoDuration','videoMode','videoTail'].map(id=>document.getElementById(id));
  let recorder,stream,rejectRecording,watchdog,preview,format,retryWebm=false,recordingStarted=false;
  const job={cancel(){controller.abort();if(recorder?.state==='recording')recorder.stop();rejectRecording?.(new DOMException('Grabación cancelada.','AbortError'))}};
  capture=job;buttons.forEach(button=>{if(button)button.disabled=true});
  const hidden=()=>{if(document.hidden)job.cancel()};
  document.addEventListener('visibilitychange',hidden);
  try{
    state.textContent='Preparando mapa y gráficas para grabar…';
    const scene=await createVideoScene(activity,controller.signal,options);timingNote(scene.timeline);
    preview=scene.canvas;
    preview.setAttribute('aria-label','Vista de la grabación: mapa y gráficas sincronizadas');
    preview.style.cssText='display:block;width:100%;max-width:1280px;height:auto;margin-top:16px';
    (document.querySelector('.video-map-panel')||document.body).appendChild(preview);
    if(typeof VideoEncoder==='function'){
      const result=await encodeVideoScene(scene,activity,controller.signal,(sample,percent,extension)=>{
        updateFrame(scene.timeline,sample);
        state.textContent=`Generando ${extension.toUpperCase()}… ${percent} %`;
      },webmOnly);
      download(result.blob,activity.name,result.extension);
      state.textContent=`Vídeo ${result.extension.toUpperCase()} descargado con mapa y gráficas sincronizadas.`;
      return;
    }
    format=recordingFormat(webmOnly);
    if(!scene.canvas.captureStream)throw Error('Este navegador no permite capturar el vídeo de la escena.');
    scene.draw(scene.timeline.at(0));stream=scene.canvas.captureStream(0);
    if(typeof stream.getVideoTracks()[0]?.requestFrame!=='function'){
      stream.getTracks().forEach(track=>track.stop());stream=scene.canvas.captureStream(30);
    }
    const videoTrack=stream.getVideoTracks()[0];
    recorder=new MediaRecorder(stream,{mimeType:format.mime,videoBitsPerSecond:8000000});
    const chunks=[];let recordingStartTime;
    await new Promise((resolve,reject)=>{
      rejectRecording=reject;
      recorder.ondataavailable=e=>{if(e.data?.size)chunks.push(e.data)};
      recorder.onerror=e=>reject(e.error||Error('No se pudo grabar el vídeo.'));
      recorder.onstop=()=>controller.signal.aborted?reject(new DOMException('Grabación cancelada.','AbortError')):resolve();
      recorder.onstart=()=>{
        if(controller.signal.aborted){if(recorder.state==='recording')recorder.stop();return}
        let lastFrame=-1;
        playRoute(activity.points,()=>{
          // Give the final requested canvas frame time to reach the recorder.
          requestAnimationFrame(()=>requestAnimationFrame(()=>{if(recorder.state==='recording')recorder.stop()}));
        },sample=>{
          const frame=Math.floor(sample.progress*scene.timeline.duration*30);
          if(frame===lastFrame)return;lastFrame=frame;
          try{scene.draw(sample);videoTrack?.requestFrame?.()}catch(e){reject(e);if(recorder.state==='recording')recorder.stop();return}
          state.textContent=`Grabando ${format.extension.toUpperCase()}… ${Math.round(sample.progress*100)} %`;
        },scene.timeline,recordingStartTime);
      };
      recordingStartTime=performance.now();recorder.start(1000);
      recordingStarted=true;
      scene.draw(scene.timeline.at(0));
      videoTrack?.requestFrame?.();
      watchdog=setTimeout(()=>{job.cancel()},(scene.timeline.duration+20)*1000);
    });
    if(controller.signal.aborted)throw new DOMException('Grabación cancelada.','AbortError');
    const blob=new Blob(chunks,{type:recorder.mimeType||format.mime});
    if(blob.size<1024)throw Error(`La grabación quedó vacía (${blob.size} bytes). Inténtalo de nuevo.`);
    download(blob,activity.name,format.extension);
    state.textContent=`Vídeo ${format.extension.toUpperCase()} descargado con mapa y gráficas sincronizadas.`;
  }catch(e){
    retryWebm=!webmOnly&&format?.extension==='mp4'&&recordingStarted&&!controller.signal.aborted&&e.name!=='AbortError';
    if(retryWebm){state.textContent='MP4 no disponible. Preparando la descarga en WebM…'}
    else{console.error(e);state.textContent=e.name==='AbortError'?'Grabación cancelada. Puedes volver a guardar la ruta.':`No se pudo guardar el vídeo: ${e.message||'error desconocido'}`}
  }finally{
    clearTimeout(watchdog);rejectRecording=null;
    if(playFrame)cancelAnimationFrame(playFrame);playFrame=null;
    if(recorder?.state==='recording')recorder.stop();
    stream?.getTracks().forEach(track=>track.stop());
    preview?.remove();
    controller.abort();document.removeEventListener('visibilitychange',hidden);
    if(capture===job)capture=null;
    buttons.forEach(button=>{if(button)button.disabled=false});
    const playButton=document.getElementById('playRoute');if(playButton)playButton.textContent='▷ Reproducir ruta';
  }
  if(retryWebm)await makeVideo(activity,true);
}
