# IA-01 — Informe de auditoría GPX/TCX y altimetría

**Fecha:** 2026-10-22
**Rama evaluada:** `eval/ia01-manus`
**Base de referencia:** `test/ia01-gpx-altimetria`
**SHA base:** `7cfdf1ec9fe0f4d72f24ecf0023293aa316ecd31`
**Alcance:** importadores GPX/TCX, procesamiento de elevación, acumulados y evaluación de los 18 fixtures de `tests/ia01/fixtures/`.

## Conclusión ejecutiva

No se confirmó un defecto funcional del cálculo bruto respecto del oráculo de IA-01 ni una regresión de importación GPX/TCX. Los 18 fixtures concuerdan con el CSV al aplicar la regla explícita de sumar diferencias positivas entre puntos consecutivos del mismo segmento, omitiendo elevaciones ausentes y sin enlazar huecos o cortes.

La aplicación no publica ese desnivel bruto como métrica principal: `app/js/elevation.js` calcula un acumulado filtrado con una media móvil corta, un umbral de reversión de 1 m y continuidad de distancia/segmento. Por eso sus valores no tienen que coincidir con el CSV bruto. El banco no define resultados esperados ni criterios mínimos para el filtrado; las coordenadas sintéticas tampoco son válidas para juzgar la distancia real. En consecuencia, las diferencias del filtrado observadas no constituyen por sí solas defectos demostrables.

**Cambios funcionales:** ninguno. No se eliminó ni modificó el suavizado.
**Pruebas de regresión añadidas:** ninguna, porque no hubo defecto confirmado que corregir. Sí se ejecutaron las pruebas existentes de acumulación e importación y se añadió este informe de auditoría.
**Producción / `main`:** no se modificaron ni se desplegaron.

## Módulos auditados

- `app/js/gpx-parser.js`: extrae tracks o rutas, conserva grupos/segmentos, omite puntos con coordenadas inválidas creando cortes, calcula distancias geodésicas dentro de cada segmento y llama a `accumulateElevation`.
- `app/js/tcx-parser.js`: agrupa puntos por cada elemento `Track`, conserva altitud ausente como `null` y delega el cálculo final al mismo flujo de GPX.
- `app/js/elevation.js`: determina cobertura (`absent`, `partial`, `complete`), limita la ventana de suavizado a cada continuidad, reinicia el ancla en cortes/huecos, aplica umbral direccional y mantiene acumulados `up`/`down` monótonos. Sin elevación devuelve `null`, no cero.
- `app/js/metrics.js`: consume los acumulados y distingue la cobertura parcial; otros módulos de visualización leen la misma serie acumulada.
- `tests/ia01/run-oracle.mjs`, `compare-app.mjs`, `import-integration.mjs` y las pruebas existentes `app/tests/ascent-tests.mjs`, `audit-high-tests.mjs`, `app-integration-tests.mjs`.

## Criterio de desnivel bruto

Se aplicó la definición de `tests/ia01/README.md`: para cada par consecutivo en el mismo `trkseg` con ambas elevaciones presentes, sumar `max(0, actual - anterior)` al ascenso y `max(0, anterior - actual)` al descenso. Tolerancia: `1e-6 m`. Las elevaciones cero y negativas son válidas. No se conectan cortes, huecos ni segmentos.

El oráculo independiente dio **18/18 PASS** y coincidió con los puntos y segmentos importados en todos los casos. Se verificó adicionalmente el cálculo bruto en los puntos devueltos por `parseGPX`, sin utilizar las coordenadas para contrastar distancia. Los hashes SHA-256 de los 18 GPX y el CSV se conservaron durante la auditoría; no se editaron fixtures ni resultados esperados.

## Desnivel filtrado: resultados y límites de interpretación

`compare-app.mjs` es una comparación diagnóstica, no un evaluador de aceptación del filtrado: etiqueta por separado bruto y filtrado, asigna 10 m artificiales por intervalo y verifica el oráculo bruto, pero no tiene umbrales de éxito para el filtrado. El README del banco también indica que los resultados filtrados no están especificados.

Ejemplos observados en la ejecución real del algoritmo:

| Caso | Bruto CSV (ascenso/descenso) | Filtrado de la aplicación (ascenso/descenso) |
|---|---:|---:|
| `01_ascenso_continuo` | 20 / 0 m | 6.6667 / 0 m |
| `03_repechos` | 20 / 10 m | 3.3333 / 0 m |
| `05_ruido_simetrico` | 4 / 4 m | 0 / 0 m |
| `07_segmentos_separados` | 20 / 0 m | 0 / 0 m |
| `11_pico_aislado` | 50 / 50 m | 6.6667 / 6.6667 m |
| `12_sin_elevacion` | 0 / 0 m bruto de pares válidos | `null` / `null` (cobertura `absent`) |
| `16_largo_escalonado` | 1000 / 0 m | 998 / 0 m |
| `17_hueco_en_descenso` | 0 / 20 m | 0 / 0 m (cobertura `partial`) |

La atenuación intensa de algunos recorridos muy cortos —por ejemplo, dos puntos por segmento o cuatro puntos totales— merece una especificación de producto y un criterio de señal/distancia antes de decidir que es incorrecta. La media móvil puede aplanar esos casos y el umbral puede eliminar oscilaciones pequeñas; el banco no fija cuáles de esas variaciones son ruido y cuáles desnivel que la métrica filtrada deba preservar. Tampoco se deben deducir distancias reales de las coordenadas ficticias. Corregirlo aquí implicaría escoger una nueva definición de métrica sin autorización técnica suficiente.

## Pruebas y resultados

El paquete declara Node `>=24` y CI usa Node 24. La primera ejecución con el Node 22.13 preinstalado no es válida como línea base de la aplicación: la integración no llegó a ejecutarse por incompatibilidad del `undici` transitivo (`createZstdDecompress` indefinido); varias suites también usan APIs de `node:module` no disponibles en esa versión.

Se repitieron las pruebas con Node `v24.22.1`:

| Comando / prueba | Resultado |
|---|---|
| `node tests/ia01/run-oracle.mjs` | **18/18 PASS** |
| `node tests/ia01/compare-app.mjs` | **18/18 oráculos PASS**; las cifras filtradas son informativas, no criterios de aprobación |
| `node tests/ia01/import-integration.mjs` | **PASS**: 18 GPX + TCX sintético con tracks separados/elevación ausente + validaciones |
| Comprobación adicional sobre resultados reales de `parseGPX` | **18/18 PASS** en puntos, segmentos y ascenso/descenso bruto |
| `app/tests/ascent-tests.mjs` | **PASS** |
| `app/tests/audit-high-tests.mjs` | **PASS** |
| `app/tests/app-integration-tests.mjs` | **PASS** |
| `npm run check` | **PASS** |
| `npm test` / `node scripts/run-tests.mjs` | **1 suite falla**, `route-planner-state-tests.mjs`: `TypeError: $(...).addEventListener is not a function` en `route-planner.js:193`, al abrir el planificador con su mock DOM. Las otras suites reportadas por el ejecutor pasaron. El error no está en importación ni altimetría. |

La suite completa tiene la misma falla antes de cualquier cambio de código; no fue “arreglada” alterando una prueba fuera del alcance. No se reporta éxito global de `npm test`.

## Archivos cambiados

- `tests/ia01/INFORME_AUDITORIA_2026-10-22.md`: este informe. No se modificaron importadores, cálculo de elevación, métricas, fixtures GPX, CSV ni pruebas existentes.

No hay regresiones nuevas porque no se corrigió ningún defecto confirmado. Las pruebas existentes ya cubren ascensos graduales, repechos, ruido, descenso, ausencia/parcialidad de elevación, continuidad, cortes y métricas derivadas.

## Pendientes y limitaciones

1. Definir explícitamente qué significa el **desnivel filtrado** y con qué datos debe evaluarse: ventana/filtro, tratamiento de bordes, umbral de reversión, distancia mínima y criterio para segmentos cortos/picos. Agregar un conjunto de expectativas filtradas solo después de aprobar esa definición.
2. La integración IA-01 valida el importador TCX con un XML sintético pequeño, no con una batería de fixtures TCX con oráculo bruto independiente.
3. Resolver en una tarea separada el mock de `route-planner-state-tests.mjs` que carece de `addEventListener`; es ajeno a IA-01 y no se alteró.
4. La primera ejecución con Node 22.13 es una limitación del entorno. Los resultados compatibles se obtuvieron con Node 24.22.1.

## Tiempo y herramientas

Tiempo transcurrido entre inicio y cierre de la sesión: aproximadamente **51 minutos** (tiempo de ejecución activa separado no disponible). Herramientas: Git/GitHub CLI para clonar y crear rama; Node.js 24.22.1 vía `npx node@24`; `npm ci`, evaluadores y suites del repositorio; JSDOM para verificar la salida real de `parseGPX`; SHA-256 para confirmar la integridad de archivos de referencia. No se desplegó ni se modificó `main`.
