# Correcciones de prioridad alta — 21 de octubre de 2026

## Cambios de código

- A01: resumen, tabla y comparación comparten `averageSpeed`, con fuente y método visibles. Se conserva la media de muestras del sensor TCX cuando existe; se distinguen velocidades derivadas del GPS y se conserva el cero válido.
- A02: zonas por FC máxima personal o reserva cardiaca, con FC de reposo. Sin configuración o intervalos de tiempo válidos no se inventa una distribución. Los valores se mantienen en memoria, no se guardan ni transmiten.
- A03–A04: una única función de elevación genera `up`/`down`; no cruza cortes ni datos ausentes. La cobertura es ausente/parcial/completa. Se muestra Sin datos o parcial cuando corresponde.
- A05: la ventana de pendientes avanza con dos punteros, evitando el recorrido cuadrático del historial durante las paradas. Parsing XML y otras tareas todavía se ejecutan en el hilo principal; no se declara resuelto todo el rendimiento móvil.
- A06: cualquier cancelación de la vista 3D despierta la espera en pausa y permite liberar tarea y controles.
- A07: el cartel respeta Sin clasificar; solo usa el nivel seleccionado. La sugerencia física no se aplica sin confirmación ni con altitud incompleta.
- A08: actualizados proveedores, consultas puntuales de Nominatim, fuentes, estadísticas y contadores en el borrador de privacidad. Se incorporaron los datos proporcionados por el responsable; falta confirmar su identificación y verificar configuración/retención de proveedores.
- A09: límites por minuto, presupuesto diario y concurrencia; Redis opcional para compartir contadores entre instancias. Sin Redis el modo local es una mitigación por instancia, no una protección distribuida. Ver activación debajo.
- A10: corregidas expectativas de catálogo y velocidad cero, y el doble Leaflet. Nuevas regresiones, comando único y CI con pruebas de navegador y descargas. El fallo de clasificación conserva la expectativa original y se corrige en la implementación.

Los hallazgos de prioridad media conservan su seguimiento independiente. No se considera cerrado el aviso definitivo ni el control distribuido por el mero hecho de disponer de este código.

## Activar contadores distribuidos

La inspección de variables del proyecto mostró únicamente ORS_API_KEY en development/preview/production. No se extrajeron sus valores. No se encontró una configuración de firewall activa mediante la consulta disponible (404); eso no demuestra ausencia de protección básica de Vercel.

1. Conectar una base Redis duradera de Upstash al proyecto Vercel `analisis-gpx-app`. Revisar el plan y sus límites antes de contratar; no se creó una base ni una suscripción.
2. Configurar directamente en Vercel, como secretos de servidor, `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN`. No pegarlos en chats ni en el repositorio. El endpoint debe ser HTTPS en un dominio `.upstash.io`.
3. Probar primero preview y después configurar las mismas variables en producción. No compartir la base con otra app salvo que se ajusten los prefijos. Las claves separan preview/production.
4. Tras configurar ambas variables, el modo distribuido se selecciona automáticamente. `API_RATE_LIMIT_MODE=distributed` hace que una configuración incompleta devuelva 503 en vez de degradar a protección local; activarlo solo cuando las credenciales estén listas. Si el contador configurado falla, se devuelve 503 sin llamar al proveedor.
5. Comprobar llamadas válidas, exceso con 429 y Retry-After, dos instancias compartiendo presupuesto y recuperación al vencer la ventana. No hacer pruebas de carga contra ORS/Overpass: usar un entorno de prueba con proveedores simulados.

Valores iniciales por endpoint:

| Endpoint | Por IP/minuto | Presupuesto global/24 h UTC | Concurrencia por instancia |
| --- | ---: | ---: | ---: |
| route | 30 | 200 | 2 |
| places | 60 | 1000 | 5 |
| localities | 60 | 2000 | 5 |

Los presupuestos cuentan intentos, incluso peticiones inválidas o proveedores fallidos. Evitan sobreconsumo a costa de poder limitar también tráfico legítimo si se agota la cuota. Ajustar después de medir uso y comparar contra el plan real de ORS. La concurrencia sigue siendo local; los contadores de minuto/día sí son compartidos en modo Redis. Las claves de IP se derivan mediante HMAC con clave secreta; caducan en su ventana, con máximo 24 horas. No contienen coordenadas, sensores ni archivos.

Se confía en X-Forwarded-For solo cuando `VERCEL=1`, bajo el proxy de Vercel que sobrescribe ese encabezado. Un despliegue fuera de Vercel debe incorporar su propio proxy de confianza antes de activar límites por IP. Sin proxy conocido se agrupan los clientes desconocidos. Referencia: https://vercel.com/docs/headers/request-headers y https://upstash.com/docs/redis/features/restapi.

## Cerrar el aviso de privacidad

Se incorporaron en `app/privacidad.html` el autor/nombre público **Perros en Bicicleta** y el correo **perrosenbicicletaperrosguaugua@gmail.com**, proporcionados por el usuario. Se añadió el domicilio indicado **Querétaro, México**. Falta confirmar la identificación del responsable. Confirmar Analytics, proveedores, conservación y contratos. Mantener el rótulo de borrador hasta completar esa revisión. El código no sustituye la validación legal de un aviso definitivo.

## Validación y publicación

```sh
npm ci
npm run check
npm test
npx playwright install --with-deps chromium
npm run test:browser
```

CI ejecuta los mismos pasos sin secretos ni llamadas a proveedores reales. Las pruebas de navegador usan tiles simulados y la biblioteca Leaflet real. Una descarga válida de video en Chromium no garantiza WebGL ni codecs de un Android o Windows particular. La regresión de pausa 3D usa el controlador real con la escena simulada.

### Resultado de la validación — 21 de octubre de 2026

Pasaron las 23 suites Node, la revisión de sintaxis, git diff --check y npm audit (0 vulnerabilidades reportadas). La descarga local de Chromium falló, pero GitHub Actions sí ejecutó correctamente Chromium: continuidad 12/12, mapas con Leaflet real 5/5 y flujo de carga GPX, zonas personales, explorador, cartel PNG y video descargado. Evidencia: https://github.com/perryhurtado-creator/analisis-gpx/actions/runs/39656375108 (código 75f83f13ca89e3b460dca1c60d7534d7d474e4be).

La rama se publicó tras recibir autorización explícita del usuario. No se declara validado un vuelo Cesium real ni la reproducción física en Android/Windows. Siguen pendientes la activación de contadores distribuidos y completar el aviso definitivo.

## Revisión documental de proveedores

Ver [REVISION_PROVEEDORES_PRIVACIDAD.md](REVISION_PROVEEDORES_PRIVACIDAD.md) para el inventario, fuentes oficiales, conservación documentada y pendientes. Prioridad alta: adaptar Nominatim al límite global y al tratamiento de puntos privados; completar evidencia de cuenta y contratos. La revisión pública no cierra el aviso definitivo.

### Migración de HeiGIT — 21 de octubre de 2026

Rutas, búsquedas y elevación usan ahora `api.heigit.org`, con sus rutas `openrouteservice/v2`, `pelias/v1` y `openelevationservice/v0`. Se conserva `ORS_API_KEY` y los controles existentes. Se actualizaron las pruebas de API para exigir los nuevos destinos. Pasaron todas las suites Node, sintaxis y `git diff --check`. La confirmación del servicio real se realiza tras el despliegue sin extraer credenciales.
