# Pruebas

Las pruebas de GPX/TCX usan `node:test` y `@xmldom/xmldom` únicamente como dependencia de desarrollo. La aplicación en navegador no incorpora esta biblioteca.

```sh
npm ci
npm test
```

Los casos cubren valores vacíos, coordenadas fuera de rango o ausentes, elevación opcional, segmentos `trkseg`/`Track`, cortes por puntos inválidos y la exclusión de esos cortes de distancia, desnivel, velocidad, zonas cardiacas, mapa y gráficas.
