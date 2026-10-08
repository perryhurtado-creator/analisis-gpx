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
- Exportación local de una escena completa (1280 × 960, 9 segundos, 30 fps) con mapa OpenStreetMap, ruta, marcador y gráficas sincronizadas. Genera MP4/H.264 si está disponible, o WebM/VP9/VP8 como alternativa. Usa WebCodecs y Mediabunny; conserva MediaRecorder como alternativa para navegadores sin WebCodecs. No requiere FFmpeg.wasm.
- Token Mapbox almacenado en `localStorage`.

## Ejecución

No abras `index.html` directamente si vas a utilizar la exportación de video.

Usa el servidor/local launcher que ya utilizabas para la versión funcional, o un servidor HTTP local.

Para guardar, abre Generar vídeo y pulsa Guardar vídeo. Mantén la página visible hasta que termine; cambiar de sección, cargar otra ruta o pasar a otra pestaña cancela la exportación. Las imágenes del mapa requieren conexión y permiso CORS del proveedor. El archivo se genera localmente, sin subir la actividad a un servidor de vídeo.

La página `app/tests/video-capture-tests.html` comprueba una descarga real con puntos sintéticos, dimensiones, duración y decodificación del archivo. Incluye opciones para comprobar WebM y cancelar una exportación.

## Nota sobre el logo

El logo real de Perros en Bicicleta todavía debe incorporarse desde el archivo original. No se ha creado una versión alternativa para evitar alterar la identidad gráfica.
