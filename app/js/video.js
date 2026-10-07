import {showVideoPoint,createMap,fitVideoRoute,getCanvas} from './map.js';
import {fmt} from './metrics.js';

let playFrame=null,ffmpegEncoder=null,videoPoints=[],profileState={elevation:null,speed:null};
export function stopRouteAnimation(){if(playFrame)cancelAnimationFrame(playFrame);playFrame=null;}
function drawProfile(id,points,field,label,unit){
  const host=document.getElementById(id);
  if(!host||!points?.length)return;
  const values=points.map(p=>Number(p[field])).filter(Number.isFinite);
  if(!values.length){host.innerHTML='<div class="chart-empty">Este archivo no incluye este dato.</div>';return}
  const W=900,H=240,p={l:48,r:15,t:15,b:28},rawMin=Math.min(...values),rawMax=Math.max(...values),pad=Math.max(1,(rawMax-rawMin)*.12),lo=rawMin-pad,hi=rawMax+pad,xMax=Math.max(...points.map(x=>Number(x.d)||0))/1000||1;
  const x=v=>p.l+v/xMax*(W-p.l-p.r),y=v=>H-p.b-(v-lo)/(hi-lo)*(H-p.t-p.b);
  const vals=points.map(pt=>[x((Number(pt.d)||0)/1000),y(Number(pt[field]))]).filter(v=>Number.isFinite(v[1]));
  const path=vals.map((v,i)=>(i?'L':'M')+v[0].toFixed(1)+' '+v[1].toFixed(1)).join('');
  const area=path+` L ${vals.at(-1)[0]} ${H-p.b} L ${vals[0][0]} ${H-p.b} Z`;
  host.innerHTML=`<div class="video-chart-head"><span>${label}</span><b id="${id}Value">—</b></div><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-label="${label}"><defs><linearGradient id="vg-${id}" x1="0" x2="0" y1="0" y2="1"><stop class="video-grad-start" offset="0"/><stop class="video-grad-end" offset="1"/></linearGradient></defs><line x1="${p.l}" x2="${W-p.r}" y1="${p.t}" y2="${p.t}" stroke="#e5eae6"/><line x1="${p.l}" x2="${W-p.r}" y1="${H-p.b}" y2="${H-p.b}" stroke="#e5eae6"/><path class="video-chart-area" d="${area}" fill="url(#vg-${id})"/><path class="video-chart-line" d="${path}"/><line class="video-chart-cursor" id="${id}Cursor" x1="${p.l}" x2="${p.l}" y1="${p.t}" y2="${H-p.b}"/><circle class="video-chart-dot" id="${id}Dot" cx="${p.l}" cy="${H-p.b}" r="4"/><text class="video-chart-readout" id="${id}Readout" x="${p.l+7}" y="${p.t+14}">—</text><text x="2" y="${p.t+6}" font-size="11" fill="#718178">${fmt(hi)}</text><text x="2" y="${H-p.b}" font-size="11" fill="#718178">${fmt(lo)}</text><text x="${p.l}" y="${H-6}" font-size="11" fill="#718178">0 km</text><text x="${W-55}" y="${H-6}" font-size="11" fill="#718178">${fmt(xMax)} km</text></svg>`;
  profileState[field]={coords:points.map(pt=>[x((Number(pt.d)||0)/1000),y(Number(pt[field]))]),min:rawMin,max:rawMax,unit,x};
}
function updateProfile(field,index){
  const state=profileState[field],points=videoPoints;
  if(!state||!points.length)return;
  const i=Math.max(0,Math.min(points.length-1,index)),p=points[i],value=Number(p[field]);
  const cursor=document.getElementById(field==='ele'?'videoElevationCursor':'videoSpeedCursor');
  const valueEl=document.getElementById(field==='ele'?'videoElevationValue':'videoSpeedValue');
  const coord=state.coords[i];
  if(cursor&&coord){cursor.setAttribute('x1',coord[0]);cursor.setAttribute('x2',coord[0])}
  const dot=document.getElementById(field==='ele'?'videoElevationDot':'videoSpeedDot');
  if(dot&&coord){dot.setAttribute('cx',coord[0]);dot.setAttribute('cy',coord[1])}
  const read=document.getElementById(field==='ele'?'videoElevationReadout':'videoSpeedReadout');
  if(valueEl&&Number.isFinite(value))valueEl.textContent=field==='ele'?Math.round(value)+' m':value.toFixed(1)+' km/h';
  if(read&&Number.isFinite(value))read.textContent=field==='ele'?Math.round(value)+' m':value.toFixed(1)+' km/h';
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
