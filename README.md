# analisis-gpx

Aplicación web local para analizar actividades GPX/TCX de **Perros en Bicicleta**.

## Arquitectura modular

```text
app/
├── index.html
├── css/
│   └── app.css
├── js/
│   ├── app.js
│   ├── gpx-parser.js
│   ├── tcx-parser.js
│   ├── metrics.js
│   ├── map.js
│   ├── charts.js
│   └── video.js
└── assets/
    └── README.md
```

### Responsabilidades

- `app.js`: entrada y coordinación de la interfaz.
- `gpx-parser.js`: lectura y procesamiento de GPX.
- `tcx-parser.js`: lectura y procesamiento de TCX.
- `metrics.js`: métricas y segmentos.
- `map.js`: Mapbox, Leaflet y marcador de recorrido.
- `charts.js`: gráficas SVG.
- `video.js`: reproducción y coordinación de la exportación.
- `video-capture.js`: composición del mapa, ruta, marcador y gráficas; codificación del vídeo.
- `video-timeline.js`: línea temporal compartida para reproducción y exportación, interpolación visual y cortes de segmentos.
- `css/app.css`: estilos.
- `assets/`: recursos gráficos de la marca.

## Funciones conservadas

- Carga GPX y TCX.
- Arrastrar y soltar.
- Distancia, tiempo, velocidad, desnivel, FC y cadencia.
- Perfil de elevación.
- Gráficas de FC y velocidad.
- Segmentación automática.
- Comparación de rutas.
- Mapbox con fallback a OpenStreetMap/Leaflet.
- Reproducción de ruta.
- Exportación local de una escena completa (1280 × 960, de 3 a 120 segundos, 9 por defecto, 30 fps) con mapa OpenStreetMap, ruta, marcador y gráficas sincronizadas. Genera MP4/H.264 si está disponible, o WebM/VP9/VP8 como alternativa. Usa WebCodecs y Mediabunny; conserva MediaRecorder como alternativa para navegadores sin WebCodecs. No requiere FFmpeg.wasm.
- Token Mapbox almacenado en `localStorage`.

## Ejecución

No abras `index.html` directamente si vas a utilizar la exportación de video.

Usa el servidor/local launcher que ya utilizabas para la versión funcional, o un servidor HTTP local.

Para guardar, abre Generar vídeo y pulsa Guardar vídeo. Mantén la página visible hasta que termine; cambiar de sección, cargar otra ruta o pasar a otra pestaña cancela la exportación. Las imágenes del mapa requieren conexión y permiso CORS del proveedor. El archivo se genera localmente, sin subir la actividad a un servidor de vídeo.

La página `app/tests/video-capture-tests.html` comprueba una descarga real con puntos sintéticos, dimensiones, duración y decodificación del archivo. Incluye opciones para comprobar WebM y cancelar una exportación.

### Reproducción y vídeo 2D

En Generar vídeo puedes elegir la duración, el avance por distancia o por tiempo y una estela de 2 o 5 segundos (o desactivarla). La ruta completa aparece tenue y el tramo recorrido se resalta. Los mismos ajustes y muestras interpoladas controlan el marcador, la altimetría y la velocidad en la reproducción y el archivo guardado.

El avance por tiempo conserva las pausas cuando todos los tiempos están presentes y ordenados. Si no lo están, aparece un aviso y se usa distancia; una ruta sin distancia acumulada avanza por puntos. Durante un intervalo entre segmentos, el marcador permanece en el último punto y salta al inicio del siguiente al llegar a su tiempo: no se dibuja ni interpola una conexión. En modo distancia se omite ese intervalo. Los datos ausentes siguen ausentes y los puntos y métricas originales no se modifican.

Los ajustes se bloquean mientras se guarda el vídeo. Cambiarlos durante la reproducción la detiene y prepara el inicio con la nueva configuración. El mapa permanece fijo; esta etapa no incluye seguimiento de cámara ni 3D.

Pruebas de la línea temporal: `node --test app/tests/video-timeline-tests.mjs`.

Referencia anterior a esta mejora: commit `d2d94822675d726a6fc0886d923b679cd075538b`.

## Nota sobre el logo

El logo real de Perros en Bicicleta todavía debe incorporarse desde el archivo original. No se ha creado una versión alternativa para evitar alterar la identidad gráfica.
