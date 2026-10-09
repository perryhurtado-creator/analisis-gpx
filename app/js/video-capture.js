import {videoMapSnapshot} from './map.js';
import {fmt} from './metrics.js';

export const VIDEO_WIDTH=1080,VIDEO_HEIGHT=1920,VIDEO_FPS=30,VIDEO_SECONDS=15;

// Interpolar únicamente dentro del mismo tramo; nunca atravesar una interrupción.
export function sampleVideoPoint(points,progress){
  const position=Math.max(0,Math.min(1,progress))*(points.length-1);
  const index=Math.floor(position),next=Math.min(index+1,points.length-1),a=points[index],b=points[next];
  const mix=b.breakBefore||a.segmentId!==b.segmentId?0:position-index;
  const point={...a};
  for(const field of ['lat','lon','d','ele','speed']){
    if(Number.isFinite(a[field])&&Number.isFinite(b[field]))point[field]=a[field]+(b[field]-a[field])*mix;
  }
  return {index,next,mix,point};
}

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
  const {min,max}=values.reduce((b,v)=>({min:Math.min(b.min,v),max:Math.max(b.max,v)}),{min:Infinity,max:-Infinity}),pad=Math.max(1,(max-min)*.12),distance=points.at(-1).d||1;
  const left=80,right=width-30,top=62,bottom=height-38;
  return {left,right,top,bottom,min,max,coords:points.map(p=>({x:left+p.d/distance*(right-left),y:Number.isFinite(p[field])?bottom-(p[field]-min+pad)/(max-min+2*pad)*(bottom-top):null}))};
}

function marker(ctx,position,color,radius){
  ctx.beginPath();ctx.arc(position.x,position.y,radius,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.stroke();
}

function drawProfile(ctx,points,field,index,state,width,height,color,label,sample){
  ctx.fillStyle='#fff';ctx.fillRect(0,0,width,height);
  ctx.font='bold 32px sans-serif';ctx.fillStyle='#16231e';ctx.fillText(label,24,39);
  const value=sample?.point[field]??points[index][field],text=Number.isFinite(value)?(field==='ele'?`${Math.round(value)} m`:`${fmt(value)} km/h`):'—';
  ctx.textAlign='right';ctx.fillText(text,width-24,39);ctx.textAlign='left';
  if(!state){ctx.font='26px sans-serif';ctx.fillText('Esta actividad no incluye este dato.',48,80);return}
  ctx.strokeStyle='#e4e9e4';ctx.lineWidth=1;
  for(const y of [state.top,state.bottom]){ctx.beginPath();ctx.moveTo(state.left,y);ctx.lineTo(state.right,y);ctx.stroke()}
  if(state.image)ctx.drawImage(state.image,0,0);
  else {
  ctx.strokeStyle=color;ctx.lineWidth=3;ctx.beginPath();
  let previous=false;
  points.forEach((p,i)=>{
    const c=state.coords[i];
    if(c.y===null){previous=false;return}
    if(!previous||p.breakBefore||(i>0&&p.segmentId!==points[i-1].segmentId))ctx.moveTo(c.x,c.y);else ctx.lineTo(c.x,c.y);
    previous=true;
  });
  ctx.stroke();
  }
  const a=state.coords[index],b=state.coords[sample?.next??index],mix=sample?.mix??0;
  const c={x:a.x+(b.x-a.x)*mix,y:a.y===null?null:(b.y===null?a.y:a.y+(b.y-a.y)*mix)};ctx.strokeStyle='#ff9f43';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(c.x,state.top);ctx.lineTo(c.x,state.bottom);ctx.stroke();
  if(c.y!==null)marker(ctx,c,'#ff9f43',5);
  ctx.font='20px sans-serif';ctx.fillStyle='#6d7d75';ctx.fillText(`${fmt(state.max)}`,4,state.top+10);ctx.fillText(`${fmt(state.min)}`,4,state.bottom);
  ctx.fillText('0 km',state.left,height-12);ctx.textAlign='right';ctx.fillText(`${fmt(points.at(-1).d/1000)} km`,state.right,height-12);ctx.textAlign='left';
}

export async function createVideoScene(activity,signal){
  const snapshot=videoMapSnapshot(activity.points);
  const tiles=await Promise.all(snapshot.tiles.map(async tile=>({...tile,img:await loadTile(tile.url,signal)})));
  if(signal.aborted)throw new DOMException('Grabación cancelada.','AbortError');
  const canvas=document.createElement('canvas');canvas.width=VIDEO_WIDTH;canvas.height=VIDEO_HEIGHT;
  const ctx=canvas.getContext('2d');
  if(!ctx)throw Error('No se pudo crear la superficie de grabación.');
  const background=document.createElement('canvas');background.width=snapshot.width;background.height=snapshot.height;
  const base=background.getContext('2d');
  if(!base)throw Error('No se pudo preparar el mapa para la grabación.');
  base.fillStyle='#e7eee7';base.fillRect(0,0,snapshot.width,snapshot.height);
  for(const tile of tiles)base.drawImage(tile.img,tile.x,tile.y,256,256);
  base.strokeStyle='#2a9b69';base.lineWidth=6;base.lineJoin='round';base.lineCap='round';base.beginPath();
  activity.points.forEach((p,i)=>{const c=snapshot.positions[i];if(i===0||p.breakBefore||p.segmentId!==activity.points[i-1].segmentId)base.moveTo(c.x,c.y);else base.lineTo(c.x,c.y)});base.stroke();
  marker(base,snapshot.positions[0],'#2a9b69',9);marker(base,snapshot.positions.at(-1),'#ee5c73',9);
  base.getImageData(0,0,1,1);
  const logo=await loadTile(new URL('../assets/logo-perros-en-bicicleta.png',import.meta.url).href,signal);
  const elevation=profile(activity.points,'ele',1080,230),speed=profile(activity.points,'speed',1080,230);
  // Preparar los trazos una sola vez para reducir trabajo por fotograma en móviles.
  for(const [state,field,color] of [[elevation,'ele','#2a9b69'],[speed,'speed','#397de8']]){
    if(!state)continue;
    const image=document.createElement('canvas');image.width=1080;image.height=230;
    const pen=image.getContext('2d');pen.strokeStyle=color;pen.lineWidth=3;pen.beginPath();let previous=false;
    activity.points.forEach((p,i)=>{const c=state.coords[i];if(c.y===null){previous=false;return}
      if(!previous||p.breakBefore||(i>0&&p.segmentId!==activity.points[i-1].segmentId))pen.moveTo(c.x,c.y);else pen.lineTo(c.x,c.y);previous=true;
    });pen.stroke();state.image=image;
  }
  return {canvas,draw(index,progress=index/Math.max(1,activity.points.length-1)){
    const sample=sampleVideoPoint(activity.points,progress);index=sample.index;
    ctx.fillStyle='#10251f';ctx.fillRect(0,0,1080,1920);
    const logoHeight=132,logoWidth=logo.naturalWidth/ logo.naturalHeight*logoHeight;
    ctx.drawImage(logo,24,24,logoWidth,logoHeight);
    ctx.fillStyle='#fff';ctx.font='bold 38px sans-serif';ctx.fillText('Perros en Bicicleta',160,62);
    ctx.font='28px sans-serif';const name=String(activity.name||'Actividad');
    const words=name.split(/\s+/);let line='',y=106;
    for(const word of words){if(ctx.measureText(line+word).width>880&&line){ctx.fillText(line,160,y);y+=36;line='';if(y>150)break}line+=word+' '}
    ctx.fillText(line,160,y,880);
    ctx.save();ctx.translate(0,180);drawProfile(ctx,activity.points,'ele',index,elevation,1080,230,'#2a9b69','Altimetría',sample);ctx.restore();
    ctx.drawImage(background,0,410);
    const a=snapshot.positions[index],b=snapshot.positions[sample.next];
    marker(ctx,{x:a.x+(b.x-a.x)*sample.mix,y:410+a.y+(b.y-a.y)*sample.mix},'#ff9f43',12);
    ctx.save();ctx.translate(0,1600);drawProfile(ctx,activity.points,'speed',index,speed,1080,230,'#397de8','Velocidad',sample);ctx.restore();
    ctx.fillStyle='#fff';ctx.font='bold 30px sans-serif';ctx.fillText(`${fmt(sample.point.d/1000)} / ${fmt(activity.points.at(-1).d/1000)} km`,24,1872);
    ctx.textAlign='right';ctx.fillText(`${Math.round(progress*100)} %`,1056,1872);ctx.textAlign='left';
    ctx.font='20px sans-serif';ctx.fillText('© OpenStreetMap contributors',24,1910);
  }};
}

export function recordingFormat(webmOnly=false){
  if(typeof MediaRecorder==='undefined')throw Error('Este navegador no permite grabar vídeo. Abre la app en un navegador compatible.');
  const types=['video/mp4;codecs=avc1.42E01E','video/mp4','video/webm;codecs=vp8','video/webm;codecs=vp9','video/webm'];
  const mime=types.find(type=>(!webmOnly||type.startsWith('video/webm'))&&MediaRecorder.isTypeSupported(type));
  if(!mime)throw Error('Este navegador no ofrece un formato de vídeo compatible.');
  return {mime,extension:mime.startsWith('video/mp4')?'mp4':'webm'};
}

export async function encodeVideoScene(scene,activity,signal,onFrame,webmOnly=false){
  const {Output,BufferTarget,CanvasSource,Mp4OutputFormat,WebMOutputFormat,canEncodeVideo}=await import('./vendor/video-encoder.js');
  const settings={width:scene.canvas.width,height:scene.canvas.height,bitrate:8000000,frameRate:VIDEO_FPS};
  let codec=null;
  for(const candidate of (webmOnly?['vp8','vp9']:['avc','vp8','vp9'])){
    if(await canEncodeVideo(candidate,settings)){codec=candidate;break}
  }
  if(!codec)throw Error('Este navegador no tiene un codificador de vídeo compatible.');
  const extension=codec==='avc'?'mp4':'webm',target=new BufferTarget();
  const output=new Output({format:extension==='mp4'?new Mp4OutputFormat():new WebMOutputFormat(),target});
  const source=new CanvasSource(scene.canvas,{codec,bitrate:settings.bitrate});
  output.addVideoTrack(source,{frameRate:VIDEO_FPS});
  const aborted=()=>{output.cancel().catch(()=>{})};
  signal.addEventListener('abort',aborted,{once:true});
  try{
    if(signal.aborted)throw new DOMException('Grabación cancelada.','AbortError');
    await output.start();
    const frames=VIDEO_FPS*VIDEO_SECONDS;
    for(let frame=0;frame<frames;frame++){
      if(signal.aborted)throw new DOMException('Grabación cancelada.','AbortError');
      const index=Math.floor(frame/(frames-1)*(activity.points.length-1));
      scene.draw(index,frame/(frames-1));onFrame(index,Math.round((frame+1)/frames*100),extension,frame/(frames-1));
      await source.add(frame/VIDEO_FPS,1/VIDEO_FPS);
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

