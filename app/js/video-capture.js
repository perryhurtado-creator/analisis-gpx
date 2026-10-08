import {videoMapSnapshot} from './map.js';
import {fmt} from './metrics.js';

function loadTile(url,signal){
  return new Promise((resolve,reject)=>{
    const img=new Image();
    img.crossOrigin='anonymous';
    const done=(error)=>{clearTimeout(timer);signal.removeEventListener('abort',abort);img.onload=null;img.onerror=null;error?reject(error):resolve(img)};
    const abort=()=>{done(new DOMException('Grabación cancelada.','AbortError'));img.src=''};
    const timer=setTimeout(()=>{done(Error('No se pudieron cargar las imágenes del mapa. Revisa tu conexión e inténtalo de nuevo.'));img.src=''},15000);
    img.onload=()=>done();
    img.onerror=()=>done(Error('No se pudo capturar el mapa. Revisa tu conexión e inténtalo de nuevo.'));
    signal.addEventListener('abort',abort,{once:true});
    if(signal.aborted){abort();return}
    img.src=url;
  });
}

function profile(points,field,width,height){
  const values=points.map(p=>p[field]).filter(Number.isFinite);
  if(!values.length)return null;
  const min=Math.min(...values),max=Math.max(...values),pad=Math.max(1,(max-min)*.12),distance=points.at(-1).d||1;
  const left=48,right=width-18,top=32,bottom=height-25;
  return {left,right,top,bottom,min,max,coords:points.map(p=>({x:left+p.d/distance*(right-left),y:Number.isFinite(p[field])?bottom-(p[field]-min+pad)/(max-min+2*pad)*(bottom-top):null}))};
}

function marker(ctx,position,color,radius){
  ctx.beginPath();ctx.arc(position.x,position.y,radius,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.stroke();
}

function drawProfile(ctx,points,field,index,state,width,height,color,label){
  ctx.fillStyle='#fff';ctx.fillRect(0,0,width,height);
  ctx.font='bold 18px sans-serif';ctx.fillStyle='#16231e';ctx.fillText(label,16,23);
  const value=points[index][field],text=Number.isFinite(value)?(field==='ele'?`${Math.round(value)} m`:`${fmt(value)} km/h`):'—';
  ctx.textAlign='right';ctx.fillText(text,width-18,23);ctx.textAlign='left';
  if(!state){ctx.font='16px sans-serif';ctx.fillText('Esta actividad no incluye este dato.',48,80);return}
  ctx.strokeStyle='#e4e9e4';ctx.lineWidth=1;
  for(const y of [state.top,state.bottom]){ctx.beginPath();ctx.moveTo(state.left,y);ctx.lineTo(state.right,y);ctx.stroke()}
  ctx.strokeStyle=color;ctx.lineWidth=2;ctx.beginPath();
  let previous=false;
  points.forEach((p,i)=>{
    const c=state.coords[i];
    if(c.y===null){previous=false;return}
    if(!previous||p.breakBefore||(i>0&&p.segmentId!==points[i-1].segmentId))ctx.moveTo(c.x,c.y);else ctx.lineTo(c.x,c.y);
    previous=true;
  });
  ctx.stroke();
  const c=state.coords[index];ctx.strokeStyle='#ff9f43';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(c.x,state.top);ctx.lineTo(c.x,state.bottom);ctx.stroke();
  if(c.y!==null)marker(ctx,c,'#ff9f43',5);
  ctx.font='12px sans-serif';ctx.fillStyle='#6d7d75';ctx.fillText(`${fmt(state.max)}`,4,state.top+10);ctx.fillText(`${fmt(state.min)}`,4,state.bottom);
  ctx.fillText('0 km',state.left,height-7);ctx.textAlign='right';ctx.fillText(`${fmt(points.at(-1).d/1000)} km`,state.right,height-7);ctx.textAlign='left';
}

export async function createVideoScene(activity,signal){
  const snapshot=videoMapSnapshot(activity.points);
  const tiles=await Promise.all(snapshot.tiles.map(async tile=>({...tile,img:await loadTile(tile.url,signal)})));
  if(signal.aborted)throw new DOMException('Grabación cancelada.','AbortError');
  const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=960;
  const ctx=canvas.getContext('2d');
  if(!ctx)throw Error('No se pudo crear la superficie de grabación.');
  const background=document.createElement('canvas');background.width=1280;background.height=560;
  const base=background.getContext('2d');
  if(!base)throw Error('No se pudo preparar el mapa para la grabación.');
  base.fillStyle='#e7eee7';base.fillRect(0,0,1280,560);
  const scale=Math.min(1280/snapshot.width,560/snapshot.height),offsetX=(1280-snapshot.width*scale)/2,offsetY=(560-snapshot.height*scale)/2;
  base.save();base.translate(offsetX,offsetY);base.scale(scale,scale);base.beginPath();base.rect(0,0,snapshot.width,snapshot.height);base.clip();
  for(const tile of tiles)base.drawImage(tile.img,tile.x,tile.y,256,256);
  base.strokeStyle='#2a9b69';base.lineWidth=5/scale;base.lineJoin='round';base.lineCap='round';base.beginPath();
  activity.points.forEach((p,i)=>{const c=snapshot.positions[i];if(i===0||p.breakBefore||p.segmentId!==activity.points[i-1].segmentId)base.moveTo(c.x,c.y);else base.lineTo(c.x,c.y)});base.stroke();
  marker(base,snapshot.positions[0],'#2a9b69',6/scale);marker(base,snapshot.positions.at(-1),'#ee5c73',6/scale);base.restore();
  // Detectar imágenes que no permiten exportarse antes de iniciar MediaRecorder.
  base.getImageData(0,0,1,1);
  const elevation=profile(activity.points,'ele',1280,170),speed=profile(activity.points,'speed',1280,170);
  return {canvas,draw(index){
    ctx.fillStyle='#10251f';ctx.fillRect(0,0,1280,960);ctx.fillStyle='#fff';ctx.font='bold 21px sans-serif';ctx.fillText('Perros en Bicicleta',20,29);ctx.font='16px sans-serif';ctx.fillText(String(activity.name||'Actividad').slice(0,90),270,29);
    ctx.save();ctx.translate(0,48);drawProfile(ctx,activity.points,'ele',index,elevation,1280,170,'#2a9b69','Altimetría');ctx.restore();
    ctx.drawImage(background,0,218);
    const position=snapshot.positions[index];marker(ctx,{x:offsetX+position.x*scale,y:218+offsetY+position.y*scale},'#ff9f43',8);
    ctx.save();ctx.translate(0,778);drawProfile(ctx,activity.points,'speed',index,speed,1280,170,'#397de8','Velocidad');ctx.restore();
    ctx.fillStyle='#fff';ctx.font='10px sans-serif';ctx.fillText('© OpenStreetMap contributors',12,959);
  }};
}

export function recordingFormat(webmOnly=false){
  if(typeof MediaRecorder==='undefined')throw Error('Este navegador no permite grabar vídeo. Abre la app en un navegador compatible.');
  const types=['video/mp4;codecs=avc1.42E01E','video/mp4','video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'];
  const mime=types.find(type=>(!webmOnly||type.startsWith('video/webm'))&&MediaRecorder.isTypeSupported(type));
  if(!mime)throw Error('Este navegador no ofrece un formato de vídeo compatible.');
  return {mime,extension:mime.startsWith('video/mp4')?'mp4':'webm'};
}

export async function encodeVideoScene(scene,activity,signal,onFrame){
  const {Output,BufferTarget,CanvasSource,Mp4OutputFormat,WebMOutputFormat,canEncodeVideo}=await import('./vendor/video-encoder.js');
  const settings={width:scene.canvas.width,height:scene.canvas.height,bitrate:8000000,frameRate:30};
  let codec=null;
  for(const candidate of ['avc','vp9','vp8']){
    if(await canEncodeVideo(candidate,settings)){codec=candidate;break}
  }
  if(!codec)throw Error('Este navegador no tiene un codificador de vídeo compatible.');
  const extension=codec==='avc'?'mp4':'webm',target=new BufferTarget();
  const output=new Output({format:extension==='mp4'?new Mp4OutputFormat():new WebMOutputFormat(),target});
  const source=new CanvasSource(scene.canvas,{codec,bitrate:settings.bitrate});
  output.addVideoTrack(source,{frameRate:30});
  const aborted=()=>{output.cancel().catch(()=>{})};
  signal.addEventListener('abort',aborted,{once:true});
  try{
    if(signal.aborted)throw new DOMException('Grabación cancelada.','AbortError');
    await output.start();
    const frames=270;
    for(let frame=0;frame<frames;frame++){
      if(signal.aborted)throw new DOMException('Grabación cancelada.','AbortError');
      const index=Math.floor(frame/(frames-1)*(activity.points.length-1));
      scene.draw(index);onFrame(index,Math.round((frame+1)/frames*100),extension);
      await source.add(frame/30,1/30);
      if(frame%5===0)await new Promise(resolve=>setTimeout(resolve,0));
    }
    await output.finalize();
    if(signal.aborted)throw new DOMException('Grabación cancelada.','AbortError');
    const blob=new Blob([target.buffer],{type:extension==='mp4'?'video/mp4':'video/webm'});
    if(blob.size<1024)throw Error('No se generó un archivo de vídeo completo.');
    return {blob,extension};
  }catch(e){await output.cancel().catch(()=>{});throw e}
  finally{signal.removeEventListener('abort',aborted)}
}
