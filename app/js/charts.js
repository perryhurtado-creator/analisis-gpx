import {fmt} from './metrics.js';

const charts = new Map();
export function clearCharts(){charts.clear()}

export function drawChart(id,pairs,color,label,onHover,onLeave){
  const host=document.getElementById(id);
  charts.delete(id);
  const runs=[];
  let run=[],previous=null,xMax=0;
  const flush=()=>{if(run.length)runs.push(run);run=[]};
  for(const pair of pairs){
    const point=pair[2];
    if(Number.isFinite(pair[0]))xMax=Math.max(xMax,pair[0]);
    if(point?.breakBefore||(point&&previous&&point.segmentId!==previous.segmentId))flush();
    if(!Number.isFinite(pair[0])||!Number.isFinite(pair[1]))flush();
    else run.push(pair);
    previous=point;
  }
  flush();
  const vals=runs.flat();
  if(vals.length<2){host.innerHTML='<div class="chart-empty">Este archivo no incluye este dato.</div>';return}
  const W=900,H=240,p={l:48,r:15,t:15,b:28};xMax=xMax||1;
  let rawMin=Infinity,rawMax=-Infinity;
  for(const pair of vals){rawMin=Math.min(rawMin,pair[1]);rawMax=Math.max(rawMax,pair[1])}
  const pad=Math.max(1,(rawMax-rawMin)*.12),lo=rawMin-pad,hi=rawMax+pad;
  const x=v=>p.l+v/xMax*(W-p.l-p.r),y=v=>H-p.b-(v-lo)/(hi-lo)*(H-p.t-p.b);
  const paths=runs;
  const pathFor=run=>run.map((v,i)=>(i?'L':'M')+x(v[0]).toFixed(1)+' '+y(v[1]).toFixed(1)).join('');
  const path=paths.map(pathFor).join('');
  const area=paths.filter(run=>run.length>1).map(run=>{
    const d=pathFor(run);
    return d+` L ${x(run.at(-1)[0])} ${H-p.b} L ${x(run[0][0])} ${H-p.b} Z`;
  }).join(' ');
  host.innerHTML=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${label}">
    <defs><linearGradient id="g-${id}" x1="0" x2="0" y1="0" y2="1"><stop stop-color="${color}" stop-opacity=".24"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>
    <line x1="${p.l}" x2="${W-p.r}" y1="${p.t}" y2="${p.t}" stroke="#e5eae6"/>
    <line x1="${p.l}" x2="${W-p.r}" y1="${H-p.b}" y2="${H-p.b}" stroke="#e5eae6"/>
    <path d="${area}" fill="url(#g-${id})"/><path d="${path}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round"/>
    ${runs.filter(run=>run.length===1).map(run=>`<circle cx="${x(run[0][0])}" cy="${y(run[0][1])}" r="2.5" fill="${color}"/>`).join('')}
    <line class="guide" x1="0" x2="0" y1="${p.t}" y2="${H-p.b}" stroke="#40574d" stroke-dasharray="4 4" opacity="0"/>
    <text class="readout" y="${p.t+14}" font-size="12" fill="#253a30"></text>
    <text x="2" y="${p.t+6}" font-size="11" fill="#718178">${fmt(hi)}</text>
    <text x="2" y="${H-p.b}" font-size="11" fill="#718178">${fmt(lo)}</text>
    <text x="${p.l}" y="${H-6}" font-size="11" fill="#718178">0 km</text>
    <text x="${W-55}" y="${H-6}" font-size="11" fill="#718178">${fmt(xMax)} km</text>
  </svg>`;
  const svg=host.querySelector('svg'),guide=host.querySelector('.guide'),read=host.querySelector('.readout');
  charts.set(id,{x,xMax,guide,read,onLeave});

  const syncGuides=km=>{
    charts.forEach(chart=>{
      const clamped=Math.max(0,Math.min(chart.xMax,km));
      chart.guide.setAttribute('x1',chart.x(clamped));
      chart.guide.setAttribute('x2',chart.x(clamped));
      chart.guide.setAttribute('opacity','1');
    });
  };

  svg.onmousemove=e=>{
    const b=svg.getBoundingClientRect(),px=(e.clientX-b.left)/b.width*W;
    const km=Math.max(0,Math.min(xMax,(px-p.l)/(W-p.l-p.r)*xMax));
    const pt=onHover(km);
    syncGuides(km);
    charts.forEach(chart=>{
      const clamped=Math.max(0,Math.min(chart.xMax,km));
      chart.read.setAttribute('x',Math.min(W-150,chart.x(clamped)+7));
      chart.read.textContent=pt?`${fmt(pt.d/1000)} km`:''; 
    });
    read.textContent=pt?`${fmt(pt.d/1000)} km · ${Number.isFinite(pt.ele)?fmt(pt.ele)+' m':''}`:'';
  };
  svg.onmouseleave=()=>{
    charts.forEach(chart=>{
      chart.guide.setAttribute('opacity','0');
      chart.read.textContent='';
    });
    onLeave();
  };
}

export function setChartCursor(km){
 charts.forEach(chart=>{
  if(!chart.guide)return;
  if(km===null||!Number.isFinite(km)){chart.guide.setAttribute('opacity','0');chart.read.textContent='';return}
  const x=chart.x(Math.max(0,Math.min(chart.xMax,km)));
  chart.guide.setAttribute('x1',x);chart.guide.setAttribute('x2',x);chart.guide.setAttribute('opacity','1');
  chart.read.setAttribute('x',Math.min(750,x+7));chart.read.textContent=km.toFixed(2)+' km';
 });
}
