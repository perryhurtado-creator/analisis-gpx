# IA-01 — Banco de pruebas de desnivel GPX

Rama aislada de producción. No altera el cálculo de la aplicación.

Los 18 archivos GPX son sintéticos y los valores de `resultados_esperados.csv` son el oráculo de **ascenso y descenso brutos**, no filtrados. La coordenada es ficticia: no sirve para verificar distancias.

Regla: para cada par de puntos consecutivos del MISMO `trkseg` con ambas elevaciones presentes, sumar `max(0, actual-anterior)` al ascenso y `max(0, anterior-actual)` al descenso. No conectar huecos ni segmentos. Elevaciones 0 y negativas son válidas. Tolerancia: 1e-6 m.

**Ejecución:** `node tests/ia01/run-oracle.mjs` (Node 24+). Esto valida los GPX contra un oráculo independiente, **no** certifica que la app use el algoritmo correcto. La integración con el código real queda para la siguiente fase.

Casos de ruido y picos: el resultado filtrado no está especificado, y no debe ajustarse a Strava sin un método explícito.

No modificar los datos de referencia al evaluar las distintas IA.
