import {showVideoPoint,createMap,fitVideoRoute,getCanvas} from './map.js';

let playFrame=null,ffmpegEncoder=null,videoPoints=[],profileState={elevation:null,speed:null};
export function stopRouteAnimation(){if(playFrame)cancelAnimationFrame(playFrame);playFrame=null;}
function drawProfile(id,points,field,label,unit){
  const host=document.getElementById(id);
  if(!host||!points?.length)return;
  const values=points.map(p=>Number(p[field])).filter(Number.isFinite);
  if(!values.length){host.innerHTML='<div class="video-chart-empty">Sin datos disponibles</div>';return}
  const W=900,H=170,padX=12,padY=18,min=Math.min(...values),max=Math.max(...values),range=max-min||1;
  const coords=points.map((p,i)=>{
    const v=Number(p[field]);
    const x=padX+(i/Math.max(1,points.length-1))*(W-padX*2);
    const y=padY+(1-(Number.isFinite(v)?(v-min)/range:.5))*(H-padY*2);
    return [x,y];
  });
  const poly=coords.map(c=>c.join(',')).join(' ');
  host.innerHTML=`<div class="video-chart-head"><span>${label}</span><b id="${id}Value">—</b></div><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-label="${label}"><polyline class="video-chart-line" points="${poly}"></polyline><line class="video-chart-cursor" id="${id}Cursor" x1="${padX}" x2="${padX}" y1="8" y2="${H-8}"></line></svg><div class="video-chart-axis"><span>${Number(min).toFixed(0)} ${unit}</span><span>${Number(max).toFixed(0)} ${unit}</span></div>`;
  profileState[field]={coords,min,max,unit};
}
function updateProfile(field,index){
  const state=profileState[field],points=videoPoints;
  if(!state||!points.length)return;
  const i=Math.max(0,Math.min(points.length-1,index)),p=points[i],value=Number(p[field]);
  const cursor=document.getElementById(field==='ele'?'videoElevationCursor':'videoSpeedCursor');
  const valueEl=document.getElementById(field==='ele'?'videoElevationValue':'videoSpeedValue');
  const coord=state.coords[i];
  if(cursor&&coord){cursor.setAttribute('x1',coord[0]);cursor.setAttribute('x2',coord[0])}
  if(valueEl&&Number.isFinite(value))valueEl.textContent=field==='ele'?Math.round(value)+' m':value.toFixed(1)+' km/h';
}
export function prepareVideoMap(points){
  if(points?.length){
    videoPoints=points;
    createMap(points,'videoMap');
    fitVideoRoute(points);
    profileState={elevation:null,speed:null};
    drawProfile('videoElevationChart',points,'ele','Altimetría','m');
    drawProfile('videoSpeedChart',points,'speed','Velocidad','km/h');
    updateProfile('ele',0);updateProfile('speed',0);
  }
}
export function playRoute(points,onDone=()=>{}){
  if(!points?.length)return;
  const state=document.getElementById('videoState'),button=document.getElementById('playRoute');
  state.textContent='Reproduciendo ruta…';button.textContent='↻ Reiniciar';
  if(playFrame)cancelAnimationFrame(playFrame);
  const start=performance.now(),total=9000;
  function step(now){
    const ratio=Math.min(1,(now-start)/total),index=Math.min(points.length-1,Math.floor(ratio*(points.length-1)));
    showVideoPoint(points[index]);updateProfile('ele',index);updateProfile('speed',index);
    if(ratio<1)playFrame=requestAnimationFrame(step);
    else{state.textContent='Reproducción terminada.';button.textContent='▷ Reproducir';playFrame=null;onDone()}
  }
  playFrame=requestAnimationFrame(step);
}
async function encoder(){
  if(!window.FFmpeg)throw Error('No se pudo cargar el motor de video. Revisa tu conexión.');
  if(!ffmpegEncoder){
    const {createFFmpeg,fetchFile}=window.FFmpeg;
    ffmpegEncoder={engine:createFFmpeg({log:false,corePath:'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js'}),fetchFile};
  }
  if(!ffmpegEncoder.engine.isLoaded())await ffmpegEncoder.engine.load();
  return ffmpegEncoder;
}
async function convertToMp4(source){
  const {engine,fetchFile}=await encoder();
  await engine.FS('writeFile','actividad.webm',await fetchFile(source));
  await engine.run('-i','actividad.webm','-c:v','mpeg4','-q:v','3','-pix_fmt','yuv420p','-movflags','+faststart','actividad.mp4');
  const bytes=engine.FS('readFile','actividad.mp4');
  try{engine.FS('unlink','actividad.webm');engine.FS('unlink','actividad.mp4')}catch(e){}
  if(!bytes||bytes.length<1024)throw Error('La conversión no produjo un video válido.');
  return new Blob([bytes.buffer],{type:'video/mp4'});
}
function download(blob,name){
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=(name||'ruta').replace(/[^a-z0-9áéíóúñ_-]/gi,'_')+'.mp4';a.click();
  setTimeout(()=>URL.revokeObjectURL(url),5000);
}
export function makeVideo(activity){
  const state=document.getElementById('videoState');
  const canvas=getCanvas();
  if(location.protocol==='file:'){state.textContent='Para exportar MP4 abre la app con INICIAR_APP.bat; no abras index.html directamente.';return}
  if(!canvas||!window.MediaRecorder){state.textContent='Este navegador no permite grabar el mapa de OpenStreetMap en esta configuración.';return}
  const recordMime=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'].find(type=>MediaRecorder.isTypeSupported(type));
  if(!recordMime){state.textContent='Este navegador no permite grabar la animación.';return}
  if(!canvas.captureStream){state.textContent='Este navegador no permite grabar el mapa.';return}
  state.textContent='Preparando el motor MP4 (la primera vez puede tardar un poco)…';
  const chunks=[],stream=canvas.captureStream(30);let recorder;
  try{recorder=new MediaRecorder(stream,{mimeType:recordMime,videoBitsPerSecond:8000000})}catch(e){state.textContent='No se pudo iniciar la grabación.';return}
  recorder.ondataavailable=e=>{if(e.data?.size)chunks.push(e.data)};
  recorder.onerror=()=>state.textContent='La grabación encontró un error.';
  recorder.onstop=async()=>{
    const source=new Blob(chunks,{type:recordMime});
    if(source.size<1024){state.textContent='La grabación quedó vacía; no se descargó ningún archivo.';return}
    try{state.textContent='Convirtiendo a MP4 localmente…';const mp4=await convertToMp4(source);download(mp4,activity.name);state.textContent='Video MP4 descargado correctamente.'}
    catch(e){console.error(e);state.textContent='No se pudo convertir a MP4: '+(e.message||'error desconocido')}
  };
  recorder.start(1000);state.textContent='Grabando ruta…';playRoute(activity.points,()=>recorder.stop());
}
