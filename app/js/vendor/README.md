# Codificador de vídeo

`video-encoder.js` contiene únicamente las exportaciones utilizadas de Mediabunny 1.61.3, empaquetadas con esbuild 0.28.2 para navegador (ESM, minificado). La licencia MIT original está en `MEDIABUNNY-LICENSE.txt`.

Fuente de la entrada del bundle:

```js
export {Output,BufferTarget,CanvasSource,Mp4OutputFormat,WebMOutputFormat,canEncodeVideo} from 'mediabunny';
```

Para regenerarlo, instala esas dos versiones en un directorio temporal, guarda la entrada anterior allí como `encoder-entry.mjs` y ejecuta esbuild desde ese directorio:

```text
node node_modules/esbuild/bin/esbuild encoder-entry.mjs --bundle --format=esm --platform=browser --minify --outfile=<repositorio>/app/js/vendor/video-encoder.js
```

Copia también `node_modules/mediabunny/LICENSE` a `MEDIABUNNY-LICENSE.txt`.

El bundle se carga únicamente al guardar vídeo. No requiere un servidor de procesamiento, FFmpeg ni encabezados de aislamiento entre orígenes. Usa WebCodecs para codificar los fotogramas y escribir MP4/H.264 o WebM/VP9/VP8 según las capacidades del navegador. El código de captura conserva MediaRecorder como alternativa cuando WebCodecs no está disponible.
