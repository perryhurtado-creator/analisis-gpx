import {showPoint,hidePoint} from './map.js';
import {setChartCursor} from './charts.js';
let points=[],total=0,index=0,cursorDistance=0,playing=false,frame=0,last=0,rate=1;
const $=id=>document.getElementById(id);
function nearestIndex(distance){
 let low=0,high=points.length-1;
 while(low<high){const mid=(low+high)>>1;if((points[mid].d||0)<distance)low=mid+1;else high=mid}
 if(low>0&&Math.abs(points[low-1].d-distance)<Math.abs(points[low].d-distance))return low-1;
 return low;
}
function render(){
 if(!points.length)return;
 const p=points[index],d=p.d||0;
 $('explorerSeek').value=String(total?Math.round(d/total*1000):0);
 $('explorerDistance').textContent=(d/1000).toFixed(2)+' km';
 $('explorerAltitude').textContent=Number.isFinite(p.ele)?Math.round(p.ele)+' m':'—';
 $('explorerProgress').textContent=(total?Math.round(d/total*100):0)+' %';
 $('explorerProgressBar').style.width=(total?d/total*100:0)+'%';
 showPoint(p);setChartCursor(d/1000);
}
function seekDistance(d){if(!points.length)return;cursorDistance=Math.max(0,Math.min(total,d));index=nearestIndex(cursorDistance);render()}
function tick(time){
 if(!playing)return;
 if(last){const delta=Math.min(100,time-last)/1000;seekDistance(cursorDistance+delta*1000*rate*0.5)}
 last=time;
 if(cursorDistance>=total){pause();return}
 frame=requestAnimationFrame(tick);
}
export function pause(){playing=false;cancelAnimationFrame(frame);last=0;if($('explorerPlay'))$('explorerPlay').textContent='▶ Reproducir'}
export function clearExplorer(){pause();points=[];index=0;cursorDistance=0;total=0;$('routeExplorer').hidden=true;hidePoint();setChartCursor(null)}
export function initExplorer(){
 $('explorerPlay').addEventListener('click',()=>{
  if(!points.length)return;
  if(playing){pause();return}
  if(cursorDistance>=total){index=0;cursorDistance=0;}
  playing=true;last=0;$('explorerPlay').textContent='Ⅱ Pausar';frame=requestAnimationFrame(tick);
 });
 $('explorerBack').addEventListener('click',()=>{pause();seekDistance((points[index]?.d||0)-5000)});
 $('explorerNext').addEventListener('click',()=>{pause();seekDistance((points[index]?.d||0)+5000)});
 $('explorerReset').addEventListener('click',()=>{pause();index=0;cursorDistance=0;render()});
 $('explorerSeek').addEventListener('input',e=>{pause();seekDistance(Number(e.target.value)/1000*total)});
 $('explorerSpeed').addEventListener('change',e=>{rate=Number(e.target.value)||1});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)pause()});
}
export function setExplorerActivity(routePoints){
 pause();points=Array.isArray(routePoints)?routePoints.filter(p=>Number.isFinite(p.d)&&Number.isFinite(p.lat)&&Number.isFinite(p.lon)):[];
 index=0;cursorDistance=0;total=points.length?points[points.length-1].d:0;
 $('routeExplorer').hidden=points.length<2;
 if(points.length>1)render();
}
export function seekExplorerKm(km){if(!points.length)return;pause();seekDistance(km*1000)}
