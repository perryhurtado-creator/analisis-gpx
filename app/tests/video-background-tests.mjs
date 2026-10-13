import assert from 'node:assert/strict';
import {watchVideoVisibility} from '../js/video-background.js';
for(const allow of [true,false]){
 const events=new Map();let cancels=0;
 const doc={hidden:false,addEventListener:(name,fn)=>events.set(name,fn),removeEventListener:(name,fn)=>{if(events.get(name)===fn)events.delete(name)}};
 const clean=watchVideoVisibility(doc,allow,()=>cancels++);
 events.get('visibilitychange')();assert.equal(cancels,0);
 doc.hidden=true;events.get('visibilitychange')();assert.equal(cancels,allow?0:1);
 doc.hidden=false;events.get('visibilitychange')();assert.equal(cancels,allow?0:1);
 clean();assert.equal(events.size,0);
}
console.log('PASS opted-in generation survives hidden state; normal mode cancels; return to foreground and cleanup verified.');
