import {sampleVideoPoint} from './video-capture.js';
// Preparar el perfil una vez; el cursor usa el mismo avance que la bicicleta.
export function createVideoElevation(points,width=1280,height=170){
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const pen=canvas.getContext('2d'),left=70,right=width-26,top=45,bottom=height-28;
  let min=Infinity,max=-Infinity;for(const p of points)if(Number.isFinite(p.ele)){min=Math.min(min,p.ele);max=Math.max(max,p.ele)}
  const valid=Number.isFinite(min),pad=valid?Math.max(1,(max-min)*.08):1,total=points.at(-1)?.d||1;
  const x=d=>left+(d||0)/total*(right-left),y=e=>bottom-(e-min+pad)/(max-min+2*pad)*(bottom-top);
  pen.fillStyle='#fff';pen.fillRect(0,0,width,height);pen.fillStyle='#17392c';pen.font='bold 23px sans-serif';pen.fillText('Altimetría',22,29);
  if(valid){
    pen.strokeStyle='#2a9b69';pen.lineWidth=3;pen.beginPath();let previous=false;
    points.forEach((p,i)=>{if(!Number.isFinite(p.ele)){previous=false;return}if(!previous||p.breakBefore||(i&&p.segmentId!==points[i-1].segmentId))pen.moveTo(x(p.d),y(p.ele));else pen.lineTo(x(p.d),y(p.ele));previous=true});pen.stroke();
    pen.font='16px sans-serif';pen.fillStyle='#526a5e';pen.fillText(Math.round(max)+' m',5,top+12);pen.fillText(Math.round(min)+' m',5,bottom);pen.fillText('0 km',left,height-7);pen.textAlign='right';pen.fillText((total/1000).toFixed(1)+' km',right,height-7);
  }else{pen.font='21px sans-serif';pen.fillText('Este archivo no incluye altitud.',22,85)}
  return {draw(ctx,progress,offsetY){
    const sample=sampleVideoPoint(points,progress),p=sample.point;
    ctx.save();ctx.translate(0,offsetY);ctx.drawImage(canvas,0,0);ctx.fillStyle='#17392c';ctx.font='bold 22px sans-serif';ctx.textAlign='right';
    ctx.fillText((Number.isFinite(p.ele)?Math.round(p.ele)+' m':'—')+' · '+((p.d||0)/1000).toFixed(2)+' km',right,29);
    if(valid){const px=x(p.d);ctx.strokeStyle='#ff9f43';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(px,top);ctx.lineTo(px,bottom);ctx.stroke();if(Number.isFinite(p.ele)){ctx.beginPath();ctx.arc(px,y(p.ele),5,0,Math.PI*2);ctx.fillStyle='#ff9f43';ctx.fill();ctx.strokeStyle='#fff';ctx.stroke()}}
    ctx.restore();return sample;
  }};
}
