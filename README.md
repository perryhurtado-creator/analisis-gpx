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
- `map.js`: OpenStreetMap, Leaflet y marcador de recorrido.
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
- Mapas OpenStreetMap/Leaflet.
- Reproducción de ruta.
- Exportación local de una escena completa (1080 × 1920, 15 segundos, 30 fps) con mapa OpenStreetMap, ruta, marcador y gráficas sincronizadas. Genera MP4/H.264 si está disponible, o WebM/VP9/VP8 como alternativa. Usa WebCodecs y Mediabunny; conserva MediaRecorder como alternativa para navegadores sin WebCodecs. No requiere FFmpeg.wasm.
- El código actual no utiliza localStorage ni sessionStorage para actividades o tokens.

## Ejecución

No abras `index.html` directamente si vas a utilizar la exportación de video.

Usa el servidor/local launcher que ya utilizabas para la versión funcional, o un servidor HTTP local.

Para guardar, abre Generar vídeo y pulsa Guardar vídeo. Mantén la página visible hasta que termine; cambiar de sección, cargar otra ruta o pasar a otra pestaña cancela la exportación. Las imágenes del mapa requieren conexión y permiso CORS del proveedor. El archivo se genera localmente, sin subir la actividad a un servidor de vídeo.

La página `app/tests/video-capture-tests.html` comprueba una descarga real con puntos sintéticos, dimensiones, duración y decodificación del archivo. Incluye opciones para comprobar WebM y cancelar una exportación.

### Vuelo cinematográfico 3D

En Generar vídeo, selecciona Cámara aérea 3D y el estilo Cinematográfico: exporta un vuelo horizontal de 1280 × 720, 40 segundos, 24 fps y sin audio. Incluye imágenes satelitales Esri, relieve real, recorrido naranja, logo original y atribuciones. El estilo Aéreo con indicadores conserva la composición vertical de 15 segundos.

Mostrar nombres de localidades consulta nodos de pueblos/ciudades de OpenStreetMap mediante `/api/localities`, filtra los que están a menos de 900 m de los tramos reales y coloca hasta tres nombres simultáneos sobre sus coordenadas. Las etiquetas se incluyen tanto en la reproducción como en la exportación. No se unen cortes del GPX para buscar pueblos. Se envía solamente el área aproximada del recorrido, sin tiempos, frecuencia cardiaca ni el archivo GPX. La consulta no requiere una nueva clave API. Las áreas mayores de 2 grados por lado o 1 grado cuadrado no se consultan. Si el servicio falla o no hay nombres, se informa al terminar y el video continúa sin etiquetas.

Antes del vuelo se cargan vistas de terreno; durante la exportación se espera a que cada nueva vista esté cargada. Cambiar de página, cargar otra actividad o pulsar Cancelar 3D cancela la tarea y libera la escena.

Pruebas: `node app/tests/video-localities-tests.mjs`, `node app/tests/localities-api-tests.mjs` y `node app/tests/cesium-camera-tests.mjs`. La página `app/tests/video-3d-tests.html?style=cinematic` comprueba la exportación cinematográfica completa y su decodificación a 1280 × 720 y 40 segundos.

## Nota sobre el logo

El logo original se incluye en `app/assets/logo-perros-en-bicicleta.png`.

## Seguridad y privacidad

La carga acepta hasta 10 MiB y 50 000 puntos por GPX/TCX. Consulta [la revisión](REVISION_SEGURIDAD.md) para cambios, pruebas y pendientes. La app enlaza [Privacidad y uso de datos](app/privacidad.html), un borrador pendiente de los datos del responsable y de verificar la configuración de los proveedores.
