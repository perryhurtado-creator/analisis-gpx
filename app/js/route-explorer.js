import {showPoint,hidePoint} from './map.js';
import {setChartCursor} from './charts.js';
let points=[],total=0,cursorDistance=0,playing=false,frame=0,last=null,rate=1;
const $=id=>document.getElementById(id);
function upperIndex(distance){
 let low=0,high=points.length-1;
 while(low<high){const mid=(low+high)>>1;if(points[mid].d<distance)low=mid+1;else high=mid}
 return low;
}
function sample(distance){
 const next=upperIndex(distance),b=points[next],a=points[Math.max(0,next-1)];
 if(a===b||b.breakBefore||a.segmentId!==b.segmentId||b.d<=a.d)return b;
 const t=Math.max(0,Math.min(1,(distance-a.d)/(b.d-a.d)));
 const lerp=(v,w)=>Number.isFinite(v)&&Number.isFinite(w)?v+(w-v)*t:null;
 return {lat:lerp(a.lat,b.lat),lon:lerp(a.lon,b.lon),ele:lerp(a.ele,b.ele),d:distance};
}
function render(){
 if(points.length<2)return;
 const p=sample(cursorDistance);
 $('explorerSeek').value=String(total?Math.round(cursorDistance/total*1000):0);
 $('explorerDistance').textContent=(cursorDistance/1000).toFixed(2)+' km';
 $('explorerAltitude').textContent=Number.isFinite(p.ele)?Math.round(p.ele)+' m':'—';
 $('explorerProgress').textContent=(total?Math.round(cursorDistance/total*100):0)+' %';
 $('explorerProgressBar').style.width=(total?cursorDistance/total*100:0)+'%';
 showPoint(p);setChartCursor(cursorDistance/1000);
}
function seekDistance(d){if(points.length<2)return;cursorDistance=Math.max(0,Math.min(total,d));render()}
function tick(time){
 if(!playing)return;
 if(last!==null){const seconds=Math.min(0.2,Math.max(0,(time-last)/1000));seekDistance(cursorDistance+seconds*total/25*rate)}
 last=time;
 if(cursorDistance>=total){pause();return}
 frame=requestAnimationFrame(tick);
}
export function pause(){playing=false;cancelAnimationFrame(frame);last=null;if($('explorerPlay'))$('explorerPlay').textContent='▶ Reproducir'}
export function clearExplorer(){pause();points=[];cursorDistance=0;total=0;$('routeExplorer').hidden=true;hidePoint();setChartCursor(null)}
export function initExplorer(){
 $('explorerPlay').addEventListener('click',()=>{
  if(points.length<2||total<=0)return;
  if(playing){pause();return}
  if(cursorDistance>=total)cursorDistance=0;
  playing=true;last=null;$('explorerPlay').textContent='Ⅱ Pausar';render();frame=requestAnimationFrame(tick);
 });
 $('explorerBack').addEventListener('click',()=>{pause();seekDistance(cursorDistance-5000)});
 $('explorerNext').addEventListener('click',()=>{pause();seekDistance(cursorDistance+5000)});
 $('explorerReset').addEventListener('click',()=>{pause();seekDistance(0)});
 $('explorerSeek').addEventListener('input',e=>{pause();seekDistance(Number(e.target.value)/1000*total)});
 $('explorerSpeed').addEventListener('change',e=>{rate=Number(e.target.value)||1});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)pause()});
}
export function setExplorerActivity(routePoints){
 pause();points=Array.isArray(routePoints)?routePoints.filter(p=>Number.isFinite(p.d)&&Number.isFinite(p.lat)&&Number.isFinite(p.lon)):[];
 cursorDistance=0;total=points.length?points[points.length-1].d:0;
 $('routeExplorer').hidden=points.length<2||total<=0;
 if(points.length>1&&total>0)render();
}
export function seekExplorerKm(km){if(!points.length)return;pause();seekDistance(km*1000)}
