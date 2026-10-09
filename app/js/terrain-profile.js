const rad=x=>x*Math.PI/180;
const metres=(a,b)=>{const h=Math.sin(rad(b[1]-a[1])/2)**2+Math.cos(rad(a[1]))*Math.cos(rad(b[1]))*Math.sin(rad(b[0]-a[0])/2)**2;return 12742000*Math.asin(Math.sqrt(Math.min(1,h)))};
export function terrainSamples(coordinates){
  const originals=coordinates.map((c,i)=>({coordinate:c.slice(0,2),d:0}));for(let i=1;i<originals.length;i++)originals[i].d=originals[i-1].d+metres(coordinates[i-1],coordinates[i]);
  const length=originals.at(-1).d,count=Math.max(2,Math.min(2000,Math.ceil(length/30)+1));
  let segment=1;const samples=Array.from({length:count},(_,i)=>{
    const d=i*length/(count-1);while(segment<originals.length-1&&originals[segment].d<d)segment++;
    const a=originals[segment-1],b=originals[segment],ratio=b.d>a.d?(d-a.d)/(b.d-a.d):0;
    return {d,coordinate:[a.coordinate[0]+ratio*(b.coordinate[0]-a.coordinate[0]),a.coordinate[1]+ratio*(b.coordinate[1]-a.coordinate[1])]};
  });
  return {originals,samples,spacing:length/(count-1)};
}
export function mergeTerrain(plan,heights){
  if(heights.length!==plan.samples.length)throw Error('Elevation sample count mismatch');
  const elevations=heights.map(z=>Number.isFinite(z)&&z>=-500&&z<=9000?z:null);
  // Ignore isolated impossible cliffs, including zero dropouts high above sea level.
  for(let i=1;i<elevations.length-1;i++){
    const a=heights[i-1],z=heights[i],b=heights[i+1];if(![a,z,b].every(Number.isFinite))continue;
    const before=plan.samples[i].d-plan.samples[i-1].d,after=plan.samples[i+1].d-plan.samples[i].d;
    if(Math.abs(z-a)>150&&Math.abs(z-b)>150&&Math.abs(z-a)>2*before&&Math.abs(z-b)>2*after&&Math.abs(a-b)<50)elevations[i]=null;
  }
  const nodes=[...plan.originals,...plan.samples].sort((a,b)=>a.d-b.d);let index=0,previous=-1;
  return nodes.filter(n=>{if(Math.abs(n.d-previous)<1e-6)return false;previous=n.d;return true}).map(n=>{
    while(index<plan.samples.length-2&&plan.samples[index+1].d<n.d-1e-6)index++;
    const a=plan.samples[index],b=plan.samples[index+1],za=elevations[index],zb=elevations[index+1];
    const ele=Math.abs(n.d-a.d)<1e-6?za:Math.abs(n.d-b.d)<1e-6?zb:za!==null&&zb!==null?za+(zb-za)*(n.d-a.d)/(b.d-a.d):null;
    return [...n.coordinate,ele];
  });
}
