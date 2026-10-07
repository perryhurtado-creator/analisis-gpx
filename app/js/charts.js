import{fmt}from'./metrics.js';

const charts=new Map();

export function splitChartSegments(pairs){
  const chunks=[];let current=[];
  const finish=()=>{if(current.length)chunks.push(current);current=[];};
  for(const pair of pairs){
    const[x,y,breakBefore=false]=pair;
    if(breakBefore)finish();
    if(!Number.isFinite(x)||!Number.isFinite(y)){finish();continue;}
    current.push([x,y]);
  }
  finish();
  return chunks;
}

export function drawChart(id,pairs,color,label,onHover,onLeave){
  const host=document.getElementById(id);
  charts.delete(id);
  const chunks=splitChartSegments(pairs),vals=chunks.flat();
  if(!chunks.some(chunk=>chunk.length>=2)){
    host.innerHTML='<div class="chart-empty">Este archivo no incluye este dato.</div>';
    return;
  }
  const W=900,H=240,p={l:48,r:15,t:15,b:28};
  const xMax=vals.reduce((max,point)=>Math.max(max,point[0]),0)||1;
  const rawMin=vals.reduce((min,point)=>Math.min(min,point[1]),Infinity);
  const rawMax=vals.reduce((max,point)=>Math.max(max,point[1]),-Infinity);
  const pad=Math.max(1,(rawMax-rawMin)*.12),lo=rawMin-pad,hi=rawMax+pad;
  const x=v=>p.l+v/xMax*(W-p.l-p.r),y=v=>H-p.b-(v-lo)/(hi-lo)*(H-p.t-p.b);
  const pathFor=chunk=>chunk.map((v,i)=>(i?'L':'M')+x(v[0]).toFixed(1)+' '+y(v[1]).toFixed(1)).join(' ');
  const linePaths=chunks.filter(chunk=>chunk.length>=2).map(pathFor).join(' ');
  const areaPaths=chunks.filter(chunk=>chunk.length>=2).map(chunk=>{
    const path=pathFor(chunk),first=chunk[0],last=chunk.at(-1);
    return`${path} L ${x(last[0])} ${H-p.b} L ${x(first[0])} ${H-p.b} Z`;
  }).join(' ');
  host.innerHTML=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${label}">
    <defs><linearGradient id="g-${id}" x1="0" x2="0" y1="0" y2="1"><stop stop-color="${color}" stop-opacity=".24"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>
    <line x1="${p.l}" x2="${W-p.r}" y1="${p.t}" y2="${p.t}" stroke="#e5eae6"/>
    <line x1="${p.l}" x2="${W-p.r}" y1="${H-p.b}" y2="${H-p.b}" stroke="#e5eae6"/>
    <path d="${areaPaths}" fill="url(#g-${id})"/><path d="${linePaths}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round"/>
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
