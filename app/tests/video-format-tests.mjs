import assert from 'node:assert/strict';
import {recordingFormat} from '../js/video-capture.js';

const select=(supported,webmOnly=false)=>{
  globalThis.MediaRecorder={isTypeSupported:type=>supported.includes(type)};
  return recordingFormat(webmOnly);
};
const mp4='video/mp4;codecs=avc1.42E028',webm='video/webm;codecs=vp8';
assert.equal(select([mp4,webm]).extension,'mp4');
// Generic MP4 support must not bypass explicit AVC capability selection.
assert.equal(select(['video/mp4',webm]).extension,'webm');
assert.equal(select([mp4,webm],true).extension,'webm');
assert.throws(()=>select(['video/mp4']),/formato/);
delete globalThis.MediaRecorder;
assert.throws(()=>recordingFormat(),/grabar/);
console.log('PASS: explicit AVC selection, WebM fallback, forced WebM and unsupported recorder.');
