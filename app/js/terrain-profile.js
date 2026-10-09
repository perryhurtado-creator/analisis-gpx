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
// Terrain grids contain short-scale vertical noise. Filter in metres, before
// interpolating onto road vertices, so totals do not depend on vertex density.
export const TERRAIN_FILTER={radius:100,tolerance:5,method:'bounded-variation-v1'};
export function filterTerrain(samples,elevations){
  const output=elevations.slice();
  let begin=0;
  while(begin<samples.length){
    if(elevations[begin]===null){begin++;continue}
    let end=begin;while(end+1<samples.length&&elevations[end+1]!==null)end++;
    const smooth=elevations.slice(begin,end+1);
    for(let i=begin+1;i<end;i++){
      let sum=0,weight=0;
      for(let j=i;j>=begin&&samples[i].d-samples[j].d<TERRAIN_FILTER.radius;j--){const w=1-(samples[i].d-samples[j].d)/TERRAIN_FILTER.radius;sum+=elevations[j]*w;weight+=w}
      for(let j=i+1;j<=end&&samples[j].d-samples[i].d<TERRAIN_FILTER.radius;j++){const w=1-(samples[j].d-samples[i].d)/TERRAIN_FILTER.radius;sum+=elevations[j]*w;weight+=w}
      smooth[i-begin]=sum/weight;
    }
    // Minimise total vertical variation inside a +/- 5 m uncertainty band.
    // Clamping in both directions, then averaging, makes the result symmetric
    // under route reversal. Endpoints stay fixed; a slow sustained climb still
    // counts in full, while small alternating changes cannot inflate totals.
    const forward=smooth.slice(),backward=smooth.slice();
    for(let i=1;i<smooth.length-1;i++)forward[i]=Math.max(smooth[i]-TERRAIN_FILTER.tolerance,Math.min(smooth[i]+TERRAIN_FILTER.tolerance,forward[i-1]));
    for(let i=smooth.length-2;i>0;i--)backward[i]=Math.max(smooth[i]-TERRAIN_FILTER.tolerance,Math.min(smooth[i]+TERRAIN_FILTER.tolerance,backward[i+1]));
    for(let i=begin;i<=end;i++)output[i]=(forward[i-begin]+backward[i-begin])/2;
    begin=end+1;
  }
  return output;
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
  const filtered=filterTerrain(plan.samples,elevations);
  const nodes=[...plan.originals,...plan.samples].sort((a,b)=>a.d-b.d);let index=0,previous=-1;
  return nodes.filter(n=>{if(Math.abs(n.d-previous)<1e-6)return false;previous=n.d;return true}).map(n=>{
    while(index<plan.samples.length-2&&plan.samples[index+1].d<n.d-1e-6)index++;
    const a=plan.samples[index],b=plan.samples[index+1],za=filtered[index],zb=filtered[index+1];
    const ele=Math.abs(n.d-a.d)<1e-6?za:Math.abs(n.d-b.d)<1e-6?zb:za!==null&&zb!==null?za+(zb-za)*(n.d-a.d)/(b.d-a.d):null;
    return [...n.coordinate,ele];
  });
}
