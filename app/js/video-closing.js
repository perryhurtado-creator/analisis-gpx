import {fmt} from './metrics.js';
export function closingLegend(activity){
  const points=activity.points||[],distance=Number.isFinite(activity.distance)?activity.distance:points.at(-1)?.d;
  const elevation=points.some(p=>Number.isFinite(p.ele));
  return {name:String(activity.name||'Ruta'),metrics:`Distancia: ${Number.isFinite(distance)?fmt(distance/1000)+' km':'—'}   ·   Desnivel positivo: ${elevation&&Number.isFinite(activity.ascent)?'+'+fmt(activity.ascent,0)+' m':'—'}`};
}
// Mantener el resumen final dos segundos, con entrada breve y sin mover la cámara.
export function drawClosingLegend(ctx,activity,progress,width,height,seconds=40){
  const remaining=(1-progress)*seconds;if(remaining>2)return;
  const alpha=Math.max(0,Math.min(1,(2-remaining)/.25)),data=closingLegend(activity);
  ctx.save();ctx.globalAlpha=alpha;ctx.fillStyle='rgba(12,18,23,.94)';
  const margin=width*.06,y=height-160;ctx.fillRect(margin,y,width-2*margin,138);
  ctx.textAlign='center';ctx.fillStyle='#fff';ctx.font='bold 30px sans-serif';
  let name=data.name;while(name.length>1&&ctx.measureText(name).width>width-2*margin-48)name=name.slice(0,-1);
  if(name!==data.name)name=name.trimEnd()+'…';ctx.fillText(name,width/2,y+49,width-2*margin-48);
  ctx.font='24px sans-serif';ctx.fillStyle='#ff9f43';ctx.fillText(data.metrics,width/2,y+99,width-2*margin-48);ctx.restore();
}
