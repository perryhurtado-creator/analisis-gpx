const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':status===200?'public, s-maxage=86400, stale-while-revalidate=3600':'no-store'}});
export async function GET(request){
  if(request.headers.get('sec-fetch-site')==='cross-site')return json({error:'Solicitud no permitida.'},403);
  const params=new URL(request.url).searchParams,q=params.get('q')?.trim();
  if(!q||q.length<3||q.length>160)return json({error:'Escribe una localidad de entre 3 y 160 caracteres.'},400);
  const key=process.env.ORS_API_KEY;
  if(!key)return json({error:'Falta configurar la clave del servicio de búsqueda en Vercel.'},503);
  const url=new URL('https://api.openrouteservice.org/geocode/search');
  url.searchParams.set('api_key',key);url.searchParams.set('text',q);url.searchParams.set('size','5');
  const lat=params.get('lat'),lon=params.get('lon');
  if(lat!==null&&lon!==null&&lat.trim()&&lon.trim()&&Number.isFinite(Number(lat))&&Number.isFinite(Number(lon))&&Math.abs(Number(lat))<=90&&Math.abs(Number(lon))<=180){url.searchParams.set('focus.point.lat',lat);url.searchParams.set('focus.point.lon',lon)}
  try{
    const response=await fetch(url,{signal:AbortSignal.timeout(15000)});
    if(!response.ok){console.error('Place search provider status:',response.status);return json({error:response.status===429?'Se alcanzó el límite de búsquedas. Intenta más tarde.':response.status===401||response.status===403?'El servicio de búsqueda no está habilitado para esta clave.':'No se pudo buscar la localidad. Intenta de nuevo.'},response.status===429?429:502)}
    const data=await response.json();if(!Array.isArray(data.features))throw Error('Invalid search response');
    const places=data.features.filter(f=>f.geometry?.type==='Point'&&Array.isArray(f.geometry.coordinates)&&f.geometry.coordinates.length>=2&&f.geometry.coordinates.slice(0,2).every(Number.isFinite)&&Math.abs(f.geometry.coordinates[0])<=180&&Math.abs(f.geometry.coordinates[1])<=90&&typeof f.properties?.label==='string').slice(0,5).map(f=>({label:f.properties.label,lon:f.geometry.coordinates[0],lat:f.geometry.coordinates[1]}));
    return json({places});
  }catch(error){console.error('Place search failed:',error.name);return json({error:error.name==='TimeoutError'?'La búsqueda tardó demasiado. Intenta de nuevo.':'No se pudo conectar con el buscador de localidades.'},502)}
}
