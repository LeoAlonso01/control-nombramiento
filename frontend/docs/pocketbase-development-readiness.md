# Preparación de persistencia PocketBase

**Nota de vigencia (2026-10-27):** la decisión posterior de utilizar la instancia PocketBase actual sustituye la propuesta anterior de mantener dos instancias. Este documento queda como registro de controles de separación y no identifica el destino vigente. La inspección de solo lectura de esa instancia está en [pocketbase-current-instance-inspection.md](pocketbase-current-instance-inspection.md). No se implementó ni probó persistencia.

## Hallazgos

- El frontend existente usa una sola variable `POCKETBASE_URL` para el cliente servidor de autenticación. No identifica por separado desarrollo y producción.
- No se encontró una instancia local/remota declarada como exclusiva de desarrollo, ni una identidad de instancia verificable.
- El `compose.yaml` del repositorio no define un servicio PocketBase. No hay migraciones versionadas ni export actual del esquema dentro del repositorio.
- `docs/security-persistence-diagnostic.md` y `docs/security-persistence-design.md` registran que el export de esquema encontrado fuera del repositorio es una referencia histórica y no acredita el esquema activo. Persisten dudas de campos, reglas, límites, índices, archivos protegidos, idempotencia, retención y versión del servidor.
- El archivo de entorno local contiene nombres de variables de servidor, pero no un selector explícito de entorno. No se leyó ni se expone aquí ningún valor.

Por estos motivos no se ejecutaron llamadas HTTP a PocketBase, no se usó la URL existente, no se escribieron endpoints de expedientes y no se preparó una migración contra un esquema supuesto.

## Selector de destino preparado

`lib/pocketbase/persistence-target.ts` contiene un selector puro para futuras operaciones de persistencia. Exige un entorno explícito coherente con `NODE_ENV` y variables distintas:

- `POCKETBASE_PERSISTENCE_ENV=development` junto con `POCKETBASE_DEVELOPMENT_URL`.
- `POCKETBASE_PERSISTENCE_ENV=production` junto con `POCKETBASE_PRODUCTION_URL`.

El selector de desarrollo acepta únicamente HTTP loopback (`localhost`, `127.0.0.1` o `[::1]`); producción exige HTTPS y rechaza loopback. La variable heredada `POCKETBASE_URL` no se usa como fallback. Esta validación evita que una operación futura seleccione una dirección remota desconocida en modo desarrollo; no prueba por sí sola que el proceso local use una base/almacenamiento aislados. El módulo no está conectado todavía al cliente de autenticación ni a una ruta de escritura.

Antes de configurar desarrollo, el responsable debe provisionar una instancia PocketBase dedicada en equipo/local de desarrollo, con proceso, base SQLite, directorio `pb_data` y archivos adjuntos separados de producción; documentar propietario y destino; y verificar su identidad mediante acceso administrativo local y metadatos/configuración del servidor. No usar un hostname Tailscale como única prueba. No copiar registros, archivos ni respaldos con expedientes reales.

Las credenciales de servicio para persistencia deben quedar en secretos del servidor en el entorno correspondiente. Nunca usar variables `NEXT_PUBLIC_*`, jamás incluir valores en ejemplos versionados o logs y usar cuentas/credenciales distintas por entorno. La estrategia privilegiada (cuenta técnica acotada o extensión PocketBase) debe aprobarse y probarse antes de construir escrituras; no se comparte una credencial privilegiada con el navegador.

## Requisito para desbloquear la implementación

Entregar un export o snapshot **tomado de la instancia aislada de desarrollo**, su versión exacta de PocketBase, colecciones y reglas actuales, además de la confirmación verificable de que su proceso/base/archivos no comparten recursos con producción. No incluir contraseñas, tokens ni claves. También deben resolverse las decisiones pendientes documentadas en `../../docs/security-persistence-design.md`, incluyendo mapeos de fechas, campos canónicos, motivo y auditoría de rechazo, idempotencia, concurrencia y política de conservación.

Con ese insumo, el orden previsto es:

1. Revisar el esquema, reglas, límites y respaldo restaurable; probar que el destino es desarrollo aislado.
2. Crear una migración aditiva y versionada que preserve datos y `estado_ocr`, y aplicarla/retirarla solo en una copia desechable de desarrollo.
3. Implementar endpoints servidor por operación: crear expediente y original, transición a `procesando`, persistir `datos_ocr`, revisión, confirmar, rechazar con actor/fecha/motivo, reintento idempotente y descarga autorizada de archivo protegido.
4. Probar con cuentas y documentos ficticios los tres roles, anonimato, usuarios inactivos, concurrencia, duplicados, errores Gemini, reintento, archivo y recuperación de respaldo.
5. Conectar UI únicamente después de pasar esas pruebas. Nunca aceptar un estado final del cliente; conservar los originales y separar `datos_ocr` de correcciones.

Las comprobaciones locales de esta preparación no sustituyen pruebas de integración. Hasta verificar escritura y lectura de un expediente ficticio en la instancia aislada, la persistencia debe describirse como **no implementada/no probada**.

## Preparación para enero de 2027

Procedimiento propuesto para el despliegue institucional, pendiente de revisión y autorización:

1. Congelar una versión de aplicación y migraciones ya probadas en desarrollo; obtener respaldo consistente de base y archivos de producción y verificar una restauración en ambiente aislado.
2. Configurar el destino de producción explícitamente con `POCKETBASE_PERSISTENCE_ENV=production` y `POCKETBASE_PRODUCTION_URL` HTTPS, además de secretos exclusivos de producción en el gestor de secretos del servidor.
3. Aplicar solo las migraciones versionadas revisadas sobre el esquema real, conservar el respaldo previo y validar reglas, acceso a archivos, cuentas y registros antes de habilitar tráfico.
4. Desplegar la aplicación sin importar ni copiar datos, usuarios o documentos de desarrollo. Ejecutar una verificación de salud no destructiva y un plan de reversión probado.
5. Registrar incidencias, responsable y resultado del respaldo/restauración. No iniciar una limpieza automática ni cambiar retención en este procedimiento.

Si se requiere registrar la fecha de inicio operativo, usar una configuración explícita de despliegue como `APP_OPERATIONAL_START_DATE=2027-01-01`, aprobada por la institución y documentada fuera de cada expediente. No clasificar un registro como prueba u oficial solo por su fecha ni usar este valor como filtro de borrado.
