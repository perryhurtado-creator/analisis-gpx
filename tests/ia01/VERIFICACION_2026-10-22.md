# IA-01 — Informe de verificación inicial (2026-10-22)

Rama: `test/ia01-gpx-altimetria`. No modificar producción.

## Ejecución local

Se reconstruyeron los 18 fixtures conforme al contenido generado para esta rama y se ejecutaron ambos scripts con Node.js v22.16.0. Se consultó el contenido de `app/js/elevation.js` en GitHub y se utilizó esa implementación sin modificarla.

- `node tests/ia01/run-oracle.mjs`: **18/18 PASS**, código de salida 0.
- `node tests/ia01/compare-app.mjs`: **18/18 oráculos PASS**, código de salida 0. Esto verifica que el comparador procesó los casos; **no** valida la corrección del ascenso filtrado.

Ejemplos de diferencias: ascenso continuo bruto 20 m vs filtrado 6.6667 m; repechos 20 m vs 3.3333 m; dos segmentos 20 m vs 0 m; pico aislado 50 m vs 6.6667 m; ruta escalonada 1000 m vs 998 m.

## Limitaciones importantes

1. La ejecución local utilizó una reconstrucción equivalente de los archivos de GitHub, no un checkout completo; falta confirmación del workflow GitHub Actions.
2. El comparador asigna 10 m artificiales entre puntos. No prueba `parseGPX`, distancias geodésicas ni rutas TCX.
3. Los resultados del algoritmo filtrado **no** deben evaluarse contra el ascenso bruto como si ambos fueran la misma métrica.
4. El paquete ZIP original de conversación tiene una representación distinta de ciertos fixtures. **Usar exclusivamente los archivos de esta rama** como fuente de verdad para las cinco IA.
5. No se ha realizado todavía la prueba de corrección de ChatGPT ni las regresiones completas de la aplicación.

## Protocolo de competencia

- Congelar el SHA de la rama base antes de empezar cada participante.
- Dar a todas las IA los mismos archivos, instrucciones, tiempo y límites de intervención.
- Guardar diagnóstico, diff, resultados de ejecución, duración y costo.
- Evaluar primero integridad de GPX, continuidad de segmentos, cobertura de elevación y regresiones; después comparar el filtrado con criterios explícitos.
- No permitir modificaciones de `tests/ia01/fixtures` ni `resultados_esperados.csv` durante una evaluación.
