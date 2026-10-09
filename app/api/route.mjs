import {terrainSamples,mergeTerrain,TERRAIN_FILTER} from '../js/terrain-profile.js';
import {elevationProfile} from '../js/planner-elevation.js';
const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function POST(request){
  if(request.headers.get('sec-fetch-site')==='cross-site')return json({error:'Solicitud no permitida.'},403);
  let body;
  try{const text=await request.text();if(text.length>8192)return json({error:'Solicitud demasiado grande.'},413);body=JSON.parse(text)}catch{return json({error:'Solicitud inválida.'},400)}
  const coords=body?.coordinates;
  if(!Array.isArray(coords)||(coords.length<2||coords.length>50)||!coords.every(c=>Array.isArray(c)&&c.length===2&&c.every(Number.isFinite)&&Math.abs(c[0])<=180&&Math.abs(c[1])<=90))return json({error:'Selecciona entre 2 y 50 puntos válidos.'},400);
  if(coords.some((c,i)=>i>0&&c.every((n,j)=>n===coords[i-1][j])))return json({error:'Dos puntos consecutivos deben ser distintos.'},400);
  const key=process.env.ORS_API_KEY;
  if(!key)return json({error:'Falta configurar ORS_API_KEY en Vercel y desplegar de nuevo.'},503);
  try{
    const response=await fetch('https://api.openrouteservice.org/v2/directions/cycling-mountain/geojson',{method:'POST',headers:{'Content-Type':'application/json','Authorization':key},body:JSON.stringify({coordinates:coords,instructions:false,elevation:false,radiuses:coords.map(()=>200)}),signal:AbortSignal.timeout(20000)});
    if(!response.ok){
      console.error('MTB routing provider status:',response.status);
      const message=response.status===429?'Se alcanzó el límite de consultas. Intenta más tarde.':response.status===401||response.status===403?'Revisa la clave de OpenRouteService en Vercel.':response.status>=500?'El servicio de rutas no está disponible. Intenta de nuevo.':'No se encontró una ruta MTB entre estos puntos. Prueba acercarlos a un camino.';
      return json({error:message},response.status===429?429:response.status>=500?502:response.status===401||response.status===403?503:422);
    }
    const data=await response.json(),feature=data.features?.[0],geometry=feature?.geometry,summary=feature?.properties?.summary;
    if(geometry?.type!=='LineString'||!Array.isArray(geometry.coordinates)||geometry.coordinates.length<2||!geometry.coordinates.every(c=>Array.isArray(c)&&c.length>=2&&Number.isFinite(c[0])&&Number.isFinite(c[1])&&Math.abs(c[0])<=180&&Math.abs(c[1])<=90)||!Number.isFinite(summary?.distance)||summary.distance<0||!Number.isFinite(summary?.duration)||summary.duration<0)throw Error('Invalid provider response');
    let elevated={type:'LineString',coordinates:geometry.coordinates.map(c=>c.slice(0,2))},elevationMessage=null,spacing=null;
    try{
      const plan=terrainSamples(elevated.coordinates);
      const result=await fetch('https://api.openrouteservice.org/elevation/line',{method:'POST',headers:{'Content-Type':'application/json','Authorization':key},body:JSON.stringify({format_in:'geojson',format_out:'geojson',geometry:{type:'LineString',coordinates:plan.samples.map(p=>p.coordinate)}}),signal:AbortSignal.timeout(20000)});
      if(!result.ok){console.error('Terrain elevation provider status:',result.status);throw Error('Terrain service unavailable')}
      const terrain=await result.json(),values=terrain.geometry?.coordinates;
      if(!Array.isArray(values)||values.length!==plan.samples.length||!values.every((c,i)=>Array.isArray(c)&&Number.isFinite(c[0])&&Number.isFinite(c[1])&&Math.abs(c[0]-plan.samples[i].coordinate[0])<0.00001&&Math.abs(c[1]-plan.samples[i].coordinate[1])<0.00001))throw Error('Invalid terrain geometry');
      elevated.coordinates=mergeTerrain(plan,values.map(c=>c[2]));spacing=plan.spacing;
    }catch(error){console.error('Terrain elevation failed:',error.name);elevationMessage='No se pudo obtener la altimetría del terreno. Pulsa Recalcular para volver a intentar.'}
    const profile=elevationProfile(elevated.coordinates,summary.distance);
    if(!profile.complete&&!elevationMessage)elevationMessage='Hay alturas ausentes o anómalas; no se muestra el acumulado incompleto.';
    return json({geometry:elevated, distance:summary.distance,duration:summary.duration,elevation:{ascent:profile.ascent,descent:profile.descent,min:profile.min,max:profile.max,complete:profile.complete,source:'SRTM · openrouteservice elevation',filter:TERRAIN_FILTER,spacing,message:elevationMessage},attribution:'© openrouteservice · © OpenStreetMap contributors'});
  }catch(error){console.error('MTB routing failed:',error.name);return json({error:error.name==='TimeoutError'?'El cálculo tardó demasiado. Intenta de nuevo.':'No se pudo conectar con el servicio de rutas.'},502)}
}
