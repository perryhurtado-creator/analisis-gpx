# Revisión de seguridad y privacidad — 10 de octubre de 2026

Base revisada: `48199fe2fb51bf892410c9e02122d5690925bfe2` de `main`.

## Alcance y hallazgos

Se revisaron parsers GPX/TCX, carga y comparación, métricas, mapas, video 2D/3D, cartel, trazador y las tres APIs. Es una revisión acotada de código y pruebas locales; no es una prueba de penetración ni certifica ausencia de vulnerabilidades.

Los GPX/TCX y los videos se procesan localmente. El trazador envía coordenadas y búsquedas a OpenRouteService mediante funciones de Vercel. Las localidades del video envían el área aproximada a Overpass. Los mapas consultan OSM y sus capas; 3D consulta Cesium y Esri. No se encontró almacenamiento persistente de actividades, cuentas, cookies propias, localStorage ni sessionStorage en `app/`. La clave ORS se obtiene de una variable de servidor; no aparece una clave privada literal en las funciones revisadas. No se revisó el historial completo de Git ni la configuración real de proveedores.

## Cambios aplicados

- Cada archivo GPX/TCX tiene un límite de 10 MiB y 50 000 puntos, también en comparación y llamadas directas al parser. El tamaño se comprueba antes de FileReader, y se comprueba de nuevo en UTF-8 al analizar XML. Se rechazan DTD/ENTITY, XML inválido y raíces de otro formato. No se recortan silenciosamente las actividades.
- Se invalidan y abortan lecturas anteriores. Nueva actividad cancela las lecturas pendientes, limpia mapas de resumen y video, el registro de gráficas y los puntos/perfiles de video. Un archivo inválido conserva la actividad actual cuando se carga desde el selector o arrastrando.
- Se separan errores de lectura/parsing de errores de presentación. La interfaz muestra mensajes y permite volver a cargar. Los nombres se mantienen como texto/HTML escapado, según la superficie.
- Se precalcula el inicio de los segmentos y se mantiene una ventana de distancia para las pendientes, evitando recorrer repetidamente todo el historial. Se conservan los límites entre segmentos.
- Se leen cuerpos JSON por chunks: máximo 8 KiB de petición de ruta, 8 MiB en respuestas de proveedores y 1 MiB para la respuesta de elevación. La geometría calculada no puede superar 50 000 puntos. Etiquetas de búsqueda: hasta 300 caracteres.
- Las búsquedas de localidades se devuelven con `Cache-Control: no-store`, al igual que las rutas. Las consultas de pueblos por área conservan la caché pública previa de 24 horas.
- El cliente cancela cálculo de ruta después de 50 segundos y búsqueda después de 20 segundos. Se conservan los plazos de las llamadas de servidor. La exportación 2D tiene un plazo global de 3 minutos; la 3D de 8 minutos. Se añade Cancelar para 2D y se impide cambiar el modo durante su exportación.
- Configuración de encabezados en `vercel.json` y `app/vercel.json`, para los dos directorios de despliegue posibles: `nosniff`, `no-referrer`, bloqueo de iframe y permisos limitados a geolocalización propia, sin cámara/micrófono. Su aplicación requiere un despliegue de Vercel.
- Se corrigió el mensaje de privacidad de la barra lateral y se enlazó `app/privacidad.html`, marcado como borrador.

## Validación

- Pasaron las 14 suites `app/tests/*-tests.mjs`, incluidas las nuevas pruebas de seguridad y las de APIs, trazador, cámara, continuidad de velocidad, elevación, capas, localidades, cartel y composición de video. Las APIs usan proveedores simulados, sin consumo de claves reales.
- Pasaron 12/12 pruebas de `continuity-tests.html` ejecutadas con DOMParser y DOM de jsdom.
- Pasó una integración de DOM con carga GPX y TCX, métricas/gráficas, nombres con HTML tratados como texto, rechazo de archivos vacíos/grandes/XML inválido/formato equivocado/más de 50 000 puntos, conservación de la actividad anterior y limpiar durante una lectura.
- Pasaron `git diff --check` y la comprobación de sintaxis de los módulos modificados.
- No fue posible ejecutar Chromium: no está instalado y la descarga del navegador no proporcionó un archivo válido. jsdom no comprueba píxeles, Leaflet real, WebGL, MediaRecorder o decodificación audiovisual. No se verificó el despliegue ni las llamadas externas en vivo.

## Pendientes para cerrar la revisión

1. Completar nombre o razón social, domicilio y correo del responsable. Confirmar registros técnicos, conservación, contratos y roles de proveedores. Revisar consentimiento para datos sensibles y transferencias antes de declarar definitivo el aviso.
2. Comprobar cookies y encabezados en el despliegue real, y probar carga/video en celular y ordenador. Los plazos y límites reducen el riesgo, pero no garantizan funcionamiento en todos los dispositivos; el XML todavía se analiza en el hilo principal.
3. Configurar límites persistentes de solicitudes o reglas de firewall en Vercel para evitar abuso de las APIs y cuotas de OpenRouteService. **No se implementó un límite distribuido de consultas ni se cambiaron reglas del firewall.** El bloqueo existente de solicitudes `cross-site` es una defensa adicional, no autenticación ni protección contra clientes automatizados.
4. Revisar dependencias/CDN, integridad de recursos y una política CSP compatible con Cesium y sus workers. No se añadió una CSP estricta sin prueba real del video 3D.
5. La ocultación de inicio/final al compartir es una mejora posterior; no se implementó aquí.
