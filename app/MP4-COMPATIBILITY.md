# Exportación MP4 y compatibilidad Windows

Base revisada: b459e5001b8d93367ddf17f11f5eb55bb63f3d81. Rollback local: rollback/mp4-before-fix.

## Diagnóstico

AVC1 identifica H.264 dentro de MP4; el mensaje de Windows no demuestra por sí solo corrupción. Sin el MP4 que falló no se pueden conocer su perfil, nivel, píxeles o estructura reales. VLC usa sus propios decodificadores y puede aceptar archivos que Windows rechaza.

WebCodecs usaba codec `avc` sin fijar perfil; Mediabunny seleccionaba automáticamente la cadena del códec. MediaRecorder solicitaba avc1.42E01E (Baseline nivel 3.0), insuficiente para 1080x1920 a 30 fps, y después aceptaba MP4 sin códec explícito. Son riesgos de compatibilidad, no causas confirmadas del archivo original.

La finalización WebCodecs ya esperaba output.finalize(); MediaRecorder ya esperaba onstop, después de los últimos datos. BufferTarget ya seleccionaba fastStart in-memory por defecto. No se encontró una descarga anticipada en esas rutas.

## Cambio

Se comprueban y usan las mismas cadenas H.264 Baseline/Main nivel 4.0 en la consulta de capacidades y CanvasSource. Estos perfiles limitan el flujo a 8 bits y 4:2:0; WebCodecs no ofrece una opción equivalente al parámetro FFmpeg pix_fmt y el formato real se debe verificar en el SPS del archivo. Se descarta alfa y se explicita MP4 convencional con moov antes de mdat. Se conserva finalize antes de descargar. Si esos perfiles no están disponibles se usa WebM VP8/VP9. MediaRecorder solicita Baseline nivel 4.0 y evita el MP4 genérico, aunque su selección MIME no garantiza el perfil real del archivo.

No se modificaron escenas, cámaras, animación, indicadores, resolución, duración ni FPS.

## Evidencia y límites

Edge headless generó una muestra sintética de 1080x1920, 30 fps, un segundo: MP4 de 16586 bytes. avcC contiene version=1, profile_idc=66 (Baseline), compatibility=4, level_idc=40 (4.0). ftyp offset 4, moov 32, mdat 849; no moof. Baseline implica 8 bits/4:2:0; no se midió independientemente el formato de píxeles con ffprobe porque no está instalado. Esta muestra verifica codificación y muxing, no una ruta Cesium completa ni Windows Media Player.

Pasaron sintaxis, git diff --check, video-elevation-tests, video-closing-tests y cesium-camera-tests. video-mobile-tests falla antes de probar la exportación: tiles.on is not a function en su simulación del mapa. Chrome headless no pudo iniciarse; Edge sí.

El soporte depende de navegador, sistema y encoder. WebCodecs requiere HTTPS o localhost. WebM no garantiza reproducción nativa en Windows. MediaRecorder controla menos parámetros y puede generar MP4 fragmentado. Equipos Windows sin componentes multimedia/H.264 necesitan resolver esa limitación del sistema; cambiar avc1 por otra etiqueta no la corrige. La generación mantiene todo en memoria y puede exceder los recursos del dispositivo.

## Comprobación del video original y aceptación final

Ejecutar con FFmpeg instalado:

```
ffprobe -v error -show_entries format=format_name,duration,size:stream=codec_name,codec_tag_string,profile,level,pix_fmt,width,height,r_frame_rate -of json video.mp4
ffmpeg -v error -i video.mp4 -f null -
```

Esperar h264/avc1, Baseline o Main, nivel 40, yuv420p, duración completa y decodificación sin errores. Revisar moov/mdat y SPS si esos datos no explican el problema. Exportar una ruta real en las cámaras existentes, comprobar indicadores y último fotograma, buscar al inicio/medio/final y reproducir en el reproductor Windows afectado. Probar también navegador sin AVC, cancelación y exportación WebM.

Conversión de recuperación, si el archivo original decodifica y se necesita normalizarlo:

```
ffmpeg -i video.mp4 -map 0:v:0 -an -c:v libx264 -profile:v main -pix_fmt yuv420p -crf 20 -movflags +faststart video-compatible.mp4
```

La conversión no soluciona ausencia del decodificador Windows. No forzar un nivel sin revisar dimensiones/FPS.

Fuentes: https://mediabunny.dev/guide/media-sources ; https://mediabunny.dev/guide/output-formats ; https://learn.microsoft.com/en-us/windows/win32/medfound/h-264-video-decoder
