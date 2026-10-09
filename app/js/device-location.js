export function currentLocation(){
  if(globalThis.isSecureContext===false)return Promise.reject(Error('La ubicación necesita una conexión segura (HTTPS).'));
  const geo=globalThis.navigator?.geolocation;
  if(!geo)return Promise.reject(Error('Este navegador no permite obtener la ubicación. Puedes escribir una localidad o tocar el mapa.'));
  return new Promise((resolve,reject)=>{
    geo.getCurrentPosition(position=>{
      const {latitude:lat,longitude:lon,accuracy}=position.coords;
      if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180){reject(Error('El dispositivo devolvió una ubicación inválida.'));return}
      resolve({lat,lon,zoom:16,label:'Ubicación actual'+(Number.isFinite(accuracy)?` · precisión aproximada ${Math.round(accuracy)} m`:'')});
    },error=>reject(Error(error.code===1?'No se autorizó el acceso a la ubicación. Puedes habilitarlo en los permisos del navegador o escribir una localidad.':error.code===3?'Se agotó el tiempo para obtener la ubicación. Intenta de nuevo.':'No se pudo obtener la ubicación. Revisa que la ubicación del dispositivo esté activada.')),
    {enableHighAccuracy:true,timeout:15000,maximumAge:0});
  });
}
