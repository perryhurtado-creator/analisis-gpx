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
- `video.js`: reproducción y exportación MP4.
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
- Grabación WebM y conversión local a MP4 mediante FFmpeg.wasm.
- Token Mapbox almacenado en `localStorage`.

## Ejecución

No abras `index.html` directamente si vas a utilizar la exportación de video.

Usa el servidor/local launcher que ya utilizabas para la versión funcional, o un servidor HTTP local.

## Nota sobre el logo

El logo real de Perros en Bicicleta todavía debe incorporarse desde el archivo original. No se ha creado una versión alternativa para evitar alterar la identidad gráfica.
