const rad=x=>x*Math.PI/180;
function metres(a,b){const dlat=rad(b[1]-a[1]),dlon=rad(b[0]-a[0]);const h=Math.sin(dlat/2)**2+Math.cos(rad(a[1]))*Math.cos(rad(b[1]))*Math.sin(dlon/2)**2;return 12742000*Math.asin(Math.sqrt(Math.min(1,h)))}
export function elevationProfile(coordinates,distance,ascent=null,descent=null){
  let d=0,up=0,down=0,complete=true,min=Infinity,max=-Infinity;
  const points=coordinates.map((c,i)=>{
    if(i)d+=metres(coordinates[i-1],c);
    const ele=Number.isFinite(c[2])?c[2]:null;
    if(ele===null)complete=false;else{min=Math.min(min,ele);max=Math.max(max,ele)}
    if(i&&ele!==null&&Number.isFinite(coordinates[i-1][2])){const diff=ele-coordinates[i-1][2];if(diff>0)up+=diff;else down-=diff}
    return {d,ele};
  });
  const scale=d>0&&Number.isFinite(distance)?distance/d:1;for(const p of points)p.d*=scale;
  return {points,ascent:complete?(Number.isFinite(ascent)&&ascent>=0?ascent:up):null,descent:complete?(Number.isFinite(descent)&&descent>=0?descent:down):null,min:Number.isFinite(min)?min:null,max:Number.isFinite(max)?max:null,complete};
}
export function elevationSVG(profile){
  const valid=profile.points.filter(p=>p.ele!==null);if(valid.length<2)return '<div class="chart-empty">No hay datos de elevación disponibles para esta ruta.</div>';
  const W=900,H=220,left=65,right=20,top=20,bottom=32,maxD=profile.points.at(-1).d||1,pad=Math.max(5,(profile.max-profile.min)*.1),lo=profile.min-pad,hi=profile.max+pad;
  const x=d=>left+d/maxD*(W-left-right),y=e=>H-bottom-(e-lo)/(hi-lo)*(H-top-bottom);
  let start=true,path='';for(const p of profile.points){if(p.ele===null){start=true;continue}path+=`${start?'M':'L'}${x(p.d).toFixed(1)} ${y(p.ele).toFixed(1)} `;start=false}
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Perfil de elevación estimado de la ruta"><line x1="${left}" x2="${W-right}" y1="${H-bottom}" y2="${H-bottom}" stroke="#dce5df"/><line x1="${left}" x2="${W-right}" y1="${top}" y2="${top}" stroke="#dce5df"/><path d="${path}" fill="none" stroke="#2a9b69" stroke-width="3" stroke-linejoin="round"/><text x="2" y="${top+5}" font-size="13" fill="#6d7d75">${Math.round(hi)} m</text><text x="2" y="${H-bottom}" font-size="13" fill="#6d7d75">${Math.round(lo)} m</text><text x="${left}" y="${H-8}" font-size="13" fill="#6d7d75">0 km</text><text x="${W-right}" y="${H-8}" text-anchor="end" font-size="13" fill="#6d7d75">${(maxD/1000).toFixed(2)} km</text></svg>`;
}
