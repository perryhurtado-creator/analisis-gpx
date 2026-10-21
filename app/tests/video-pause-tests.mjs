import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
let disposed=0;
globalThis.auditDispose=()=>disposed++;
const hook=registerHooks({load(url,context,next){
  if(url.endsWith('/cesium-scene.js'))return {format:'module',shortCircuit:true,source:`export async function createCesiumVideoScene(){return {canvas:{setAttribute(){},classList:{toggle(){}}},fps:24,seconds:40,async draw(){},dispose(){globalThis.auditDispose()}}}`};
  return next(url,context);
}});
const elements=new Map(),get=id=>{if(!elements.has(id))elements.set(id,{disabled:false,textContent:'',value:'drone',checked:false,replaceChildren(){},appendChild(){}});return elements.get(id)};
globalThis.document=new EventTarget();Object.assign(document,{hidden:false,getElementById:get,querySelector(){return null}});
const v=await import('../js/video-3d.js');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function scenario(cancel){
  let ended=false;document.hidden=false;
  const task=v.playVideo3D({points:[{d:0},{d:100}]}).then(()=>ended=true);
  await wait(10);v.pauseVideo3D();await wait(60);assert(v.video3DBusy());
  cancel();await Promise.race([task,wait(500)]);
  assert(ended,'Cancelar debe resolver la espera de pausa');assert.equal(v.video3DBusy(),false);assert.equal(get('playRoute').disabled,false);assert.equal(get('makeVideo').disabled,false);assert.equal(get('pauseVideo').disabled,true);
}
await scenario(()=>{document.hidden=true;document.dispatchEvent(new Event('visibilitychange'))});
await scenario(()=>v.stopVideo3D());
assert.equal(disposed,2);hook.deregister();delete globalThis.auditDispose;
console.log('PASS pausa 3D: ocultación y cancelación manual resuelven la tarea, liberan escena y restauran controles; se permite iniciar otra tarea.');
