# Revisión de la instancia PocketBase actual

**Fecha:** 2026-10-27  
**Alcance:** inspección local y solicitudes HTTP de solo lectura. No se leyeron ni modificaron registros.

## Decisiones confirmadas para la siguiente fase

Se utilizará la instancia actual cuando su configuración activa pueda revisarse. Se conserva el catálogo de estados `pendiente`, `procesando`, `revision_manual`, `confirmado`, `error` y `rechazado`; se usará borrado lógico, sin borrado físico desde la aplicación; SSE debe seguir los permisos de PocketBase; no se aplicará todavía el filtro temporal de enero de 2027 y no habrá eliminación automática.

## Resultado

El usuario eligió la instancia PocketBase actualmente configurada como destino futuro de persistencia. La configuración local solo expone el nombre `POCKETBASE_URL`; no incluye un selector de entorno ni una identidad verificable de instancia. No se encontró un archivo de esquema PocketBase en el repositorio ni en los directorios de proyectos/documentos examinados. Los documentos del repositorio refieren un export externo que no está disponible aquí y advierten que no acredita el esquema activo.

Se hizo una solicitud sin credenciales a la URL ya configurada, sin mostrarla:

- `GET /api/health`: HTTP 200, respuesta `API is healthy.`. La respuesta no incluyó versión del servidor; solo el indicador `canBackup`.
- `GET /api/collections?perPage=200`: HTTP 401. No fue posible leer colecciones ni reglas con acceso anónimo.

Esto confirma que hay un servicio PocketBase disponible en la dirección configurada, pero **no confirma qué instancia institucional es, su versión, sus colecciones ni sus reglas activas**. No se usó el administrador en navegador ni se solicitaron credenciales. No se intentó leer registros, subir documentos, escribir datos o cambiar reglas.

## Soft delete y tiempo real

- El único esquema disponible sigue siendo la exportación histórica descrita en `../../docs/security-persistence-design.md`, que lista `delete_at` como campo `date`. No se puede asegurar que exista o tenga ese tipo en la colección activa; por tanto no se implementaron marcado/restauración ni filtros de listados.
- La búsqueda de llamadas `.delete()` en el código de aplicación no encontró borrado físico de expedientes. Tampoco existen actualmente endpoints de expediente que puedan aplicar soft delete.
- El SDK instalado es `pocketbase` 0.28.1; su README declara `collection(...).subscribe(topic, callback)` y la función de cancelación retornada. Aún no se configura suscripción: sin conocer `listRule`, `viewRule` y campos expuestos, no puede demostrarse que SSE respete el acceso y no difunda información personal.
- La exportación histórica menciona archivos no protegidos y reglas vacías. Si esas reglas siguieran activas, abrir SSE o listados a través de la API no sería seguro. No se intentó eludirlas ni se cambiaron.

## Efectos en la implementación

Se detuvo el trabajo remoto antes de crear migraciones o endpoints de escritura. El código existente no tiene rutas de creación/lectura/revisión de expedientes; las rutas actuales solo ejecutan extracción de Gemini. No es seguro adaptar la exportación histórica por su cuenta: campos, tipos, límites de archivo, `protected`, reglas, índices y estados activos no están verificados. En particular, no se debe equiparar `fecha_emision` con `fecha_nombramiento` ni `fecha_declaracion` con `fecha`.

El ejemplo de API y la decisión de usar la instancia actual identifican el destino previsto, pero no sustituyen la verificación administrativa de versión, reglas, `delete_at`, campos de estado, `protected` e índices solicitada antes de implementar persistencia.

No se creó ningún usuario. Se conservó intacta la autenticación actual y el administrador existente. No se cambió `POCKETBASE_URL`, `.env.local`, la matriz de roles, la base, los archivos ni la infraestructura.

El selector `lib/pocketbase/persistence-target.ts` y sus pruebas corresponden a la preparación anterior para dos destinos. No está conectado a la autenticación ni a operaciones de expediente, y no configura ni valida la identidad de la instancia actual.

## Paso manual requerido

El administrador actual debe obtener, desde la instancia prevista, una exportación de esquema que incluya versión exacta del servidor, colecciones `users`, `nombramientos` y `declaraciones`, campos/opciones/índices, reglas de acceso y configuración de archivos. Antes de cualquier escritura debe verificarse administrativamente que esa instancia es el destino acordado y revisar si contiene datos oficiales. Compartir solo ese esquema saneado; **no enviar contraseñas, tokens, cookies, claves ni respaldos con registros reales**.

Con esos datos se puede preparar una migración aditiva revisable. Después de revisar y aprobar el impacto, se podrá probar el ciclo real con un expediente ficticio, recuperar el registro y el archivo original y verificar reglas y permisos. Hasta completar esa prueba, la persistencia no está implementada ni probada.

## Criterio temporal para enero de 2027

No se aplica filtro temporal global. Al definir consultas de servidor futuras, distinguir:

- `fecha_recepcion`: recepción institucional del documento.
- `fecha_emision` o `fecha_nombramiento`, según el concepto confirmado para nombramientos.
- `fecha_declaracion` o `fecha`, según el concepto confirmado para declaraciones.
- `created`: fecha técnica de creación del registro en PocketBase.

El filtro de inicio operativo debe aplicarse solo en los listados/reportes que correspondan, conservar los históricos y permitir acceso administrativo a registros anteriores cuando se necesite. No usar la fecha como única señal de que un registro sea ficticio u oficial.
