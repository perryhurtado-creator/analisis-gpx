// El mismo diseño se usa en Leaflet, Cesium y la exportación de video.
export const BICYCLE_COLOR='#ff9f43';
const frame=[[14,30,25,12],[25,12,35,30],[35,30,14,30],[25,12,43,12],[43,12,35,30],[43,12,50,30],[43,12,40,5]];
const detail=[[25,12,23,7],[18,7,28,7],[38,5,45,3],[35,30,40,33],[40,33,44,33]];
const path=lines=>lines.map(([x,y,a,b])=>'M'+x+' '+y+'L'+a+' '+b).join(' ');
export const bicycleSVG='<svg xmlns="http://www.w3.org/2000/svg" width="64" height="44" viewBox="0 0 64 44"><g fill="none" stroke-linecap="round" stroke-linejoin="round"><g stroke="#fff" stroke-width="9"><circle cx="14" cy="30" r="10"/><circle cx="50" cy="30" r="10"/><path d="'+path(frame.concat(detail))+'"/></g><g stroke="#252827" stroke-width="4"><circle cx="14" cy="30" r="10"/><circle cx="50" cy="30" r="10"/></g><path stroke="'+BICYCLE_COLOR+'" stroke-width="4" d="'+path(frame)+'"/><path stroke="#252827" stroke-width="3" d="'+path(detail)+'"/></g><circle cx="35" cy="30" r="3" fill="#252827"/></svg>';
export const bicycleDataURI='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(bicycleSVG);
export function drawBicycle(ctx,position,width=64){
  ctx.save();ctx.translate(position.x-width/2,position.y-width*22/64);ctx.scale(width/64,width/64);
  ctx.lineCap='round';ctx.lineJoin='round';
  function wheels(color,lineWidth){ctx.strokeStyle=color;ctx.lineWidth=lineWidth;for(const x of [14,50]){ctx.beginPath();ctx.arc(x,30,10,0,Math.PI*2);ctx.stroke()}}
  function lines(items,color,lineWidth){ctx.strokeStyle=color;ctx.lineWidth=lineWidth;ctx.beginPath();for(const [x,y,a,b] of items){ctx.moveTo(x,y);ctx.lineTo(a,b)}ctx.stroke()}
  wheels('#fff',9);lines(frame.concat(detail),'#fff',9);wheels('#252827',4);lines(frame,BICYCLE_COLOR,4);lines(detail,'#252827',3);
  ctx.fillStyle='#252827';ctx.beginPath();ctx.arc(35,30,3,0,Math.PI*2);ctx.fill();ctx.restore();
}
