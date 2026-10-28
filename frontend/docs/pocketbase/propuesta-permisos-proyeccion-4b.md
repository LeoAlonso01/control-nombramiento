# Propuesta local: permisos y proyección de expedientes (Fase 4B)

Estado: diseño para aprobación. No se consultó ni modificó PocketBase. No se crearon cuentas, tokens ni credenciales.

## Hechos y límites

- El contexto aprobado indica que las cinco reglas de `nombramientos` y `declaraciones` siguen en **Admins only**. Se mantienen así durante esta fase.
- `getVerifiedSessionContext` renueva la sesión contra `users`, rechaza `activo !== true` y resuelve el rol desde el registro renovado. La ruta de nombramientos todavía responde 503 y no llama al repositorio.
- El cliente de `lib/pocketbase/server.ts` es por solicitud y usa la sesión del usuario. No existe en el código inspeccionado un cliente ni una credencial de servicio privilegiada.
- La exportación local solo contiene `nombramientos` y `declaraciones`; no confirma el esquema activo ni reglas. `users`, `rol`, `activo`, CURP y `APP_ADMIN_USER_ID` no se verificaron contra la instancia.
- La exportación muestra `documento` con `protected=false`, `datos_ocr`, `delete_at`, y campos de estado; todo esto requiere validación administrativa. `estado_proceso` exportado no incluye `rechazado`, aunque el flujo local sí lo contempla.

## Matriz local de permisos

La matriz de aplicación está en `lib/auth/authorization.ts`. La autorización de operaciones sobre registros está en `lib/auth/record-authorization.ts` y necesita recibir el estado cargado del servidor.

| Operación | Admin | Capturista | Auditor |
|---|---:|---:|---:|
| Leer identificación y estado | Sí | Sí | Sí |
| Crear | Sí | Sí | No |
| Corregir expediente no final | Sí | Sí | No |
| Confirmar desde revisión manual | Sí | No | No |
| Rechazar desde revisión manual | Sí | No | No |
| Leer documento original | Sí | Sí | No |
| Borrado lógico / restauración | Sí | No | No |
| Borrado físico | No | No | No |
| Leer o administrar `users` desde endpoints de la app | No habilitado | No | No |

`confirmado` y `rechazado` son terminales para la operación normal `correct`, también para `admin`. Una corrección excepcional de un expediente final requiere un flujo y una auditoría propios; no se incluye en esta matriz.

## DTOs por rol

`lib/records/projections.ts` crea objetos con allowlist, no serializa el registro PocketBase original:

- **Auditor:** identificadores de expediente, datos de identificación y estado. En declaraciones omite por completo `curp_declarante`; en ambos recursos omite `datos_ocr`, observaciones, campos no allowlisted, archivos, nombres de archivo, file tokens y URLs.
- **Capturista:** DTO discriminado para su rol; recibe los campos de captura y OCR y, en declaraciones, CURP. No recibe referencias de archivos. La lectura del original debe pasar por una ruta de descarga autorizada.
- **Admin:** DTO discriminado para su rol con campos de captura/OCR; tampoco incorpora nombres, tokens o URLs de archivos. La descarga se hace por separado.

La proyección solo protege respuestas que atraviesan el servidor. Una regla `list/view` de PocketBase para el auditor le permitiría pedir directamente el registro completo, incluidos los campos sensibles. Las reglas de colección no ocultan campos.

## Arquitectura para lectura real

Para mantener el DTO del auditor, la propuesta conservadora es un BFF de Next.js que:

1. valide la sesión y el rol con `getVerifiedSessionContext`;
2. obtenga el registro mediante una identidad estrictamente de servidor;
3. proyecte el DTO según el rol antes de generar la respuesta;
4. no devuelva el objeto PocketBase, CURP completa, OCR, campos de archivo ni tokens al auditor.

Las reglas directas de las colecciones completas permanecen cerradas. El cliente PocketBase por usuario existente no puede leerlas mientras sigan Admins only. **No hay credencial de servicio en el repositorio y no se agrega en esta fase**, por lo que la ruta debe continuar en 503. Antes de habilitar el BFF se debe aprobar y provisionar una identidad técnica; si es superuser, su token puede eludir todas las reglas y su compromiso tiene impacto total. Una alternativa es separar los campos sensibles en una estructura con reglas propias, pero eso requiere diseño y migración aprobados.

El listado de auditoría no debe incluir conteos o datos derivados de campos que no puede ver. El cliente no debe conectarse directamente a PocketBase.

## Reglas propuestas para revisión

### Colecciones completas actuales

Durante 4B, conservar **list, view, create, update y delete como Admins only** en `nombramientos` y `declaraciones`. Es compatible con el BFF proyectado y mantiene bloqueada la API directa. El BFF privilegiado futuro no debe confundirse con la regla de autorización de aplicación: Next seguirá comprobando el usuario y cada operación.

La siguiente expresión es solo una alternativa si se crea y aprueba una colección de proyección que no contenga CURP, OCR ni archivos; no debe aplicarse a las colecciones mixtas existentes:

```text
@request.auth.id != "" &&
@request.auth.activo = true &&
(
  @request.auth.rol = "admin" ||
  @request.auth.rol = "capturista" ||
  @request.auth.rol = "auditor"
)
```

Se usaría en `listRule` y `viewRule` de esa proyección. Su sintaxis y resultado deben probarse contra la versión activa antes de usarla.

### Escrituras futuras

En esta fase, `createRule`, `updateRule` y `deleteRule` se quedan Admins only. Si posteriormente se aprueban operaciones, la intención funcional para revisión es:

- **Crear:** admin o capturista activo; el servidor fija el estado inicial y el actor. No aceptar estados terminales ni campos de auditoría desde el cliente.
- **Corregir:** capturista solo si el servidor cargó el estado actual y no es `confirmado` ni `rechazado`. Los campos de estado, OCR original, borrado lógico y auditoría quedan fuera de su payload.
- **Confirmar/rechazar:** solo admin, desde `revision_manual`; motivo requerido para rechazo. La transición se valida contra el estado persistido, nunca contra el enviado en el body.
- **Borrado lógico/restauración:** solo admin, con motivo y actor/fecha registrados. La API `delete` permanece Admins only; ningún endpoint de la aplicación ejecuta borrado físico.

No se propone una regla `updateRule` amplia por rol: permitiría llamadas directas a PocketBase que eviten la validación de Next. Cualquier futura regla de escritura debe impedir cambios a campos fuera de la operación mediante condiciones de campo probadas en la versión activa, o mantener las escrituras detrás del BFF privilegiado y bloquear la API directa.

### Colección `users`

Propuesta para las cinco reglas: Admins only. No exponer listado ni vista de perfiles, creación pública, actualización propia o borrado propio. No hay endpoint de registro o administración de usuarios en la aplicación. El inicio de sesión existente continúa usando `authWithPassword` y la verificación server-side.

Se puede evaluar `authRule` para impedir autenticar cuentas inactivas, pero no se incluye como regla final hasta probar su interacción con login y renovación de sesión. La validación `activo === true` en Next se conserva.

## Archivos

La exportación muestra `protected=false`, pero el estado activo no está confirmado. Antes de abrir acceso:

- confirmar `protected`, límites, tipos MIME y nombres de campo en el panel;
- proteger los documentos sensibles en PocketBase antes de habilitar usuarios;
- no incluir el valor de `documento`, su nombre, token de archivo ni URL en DTOs;
- usar una ruta server-side que vuelva a validar rol y acceso al registro y transmita el archivo con `Cache-Control: private, no-store`;
- auditor recibe denegación antes de generar tokens o leer el archivo; no poner tokens de archivo en HTML, logs ni respuestas reutilizables.

Cambiar `protected` es una operación de esquema remota y queda pendiente de aprobación y prueba.

## `APP_ADMIN_USER_ID`

La resolución local ahora concede `admin` a ese ID solo si el registro renovado también tiene `rol === "admin"`. Si no coincide, el rol queda nulo y la matriz deniega el acceso. No se actualiza ninguna cuenta automáticamente.

Antes de habilitar lectura, una persona autorizada debe comprobar manualmente que la cuenta correspondiente está activa y tiene `rol=admin`. No se lee ni se registra el valor de la variable en logs. La regla PocketBase consulta el rol almacenado y no conoce la excepción de entorno.

## Auditoría propuesta

El export no muestra campos de actor ni bitácora. Los campos técnicos estándar `created`/`updated`, si existen en la instancia, indican tiempo pero no actor ni motivo. Se propone una bitácora append-only pendiente de aprobar y migrar con:

| Campo propuesto | Uso |
|---|---|
| `record_collection`, `record_id` | Identificar recurso y expediente sin duplicar el documento |
| `actor_id` | ID de usuario autenticado que ejecutó la operación |
| `occurred_at` | Fecha/hora del servidor en UTC |
| `operation` | crear, corregir, confirmar, rechazar, borrar lógico o restaurar |
| `reason` | Motivo requerido para rechazo, borrado/restauración y correcciones excepcionales |
| `outcome` | Resultado de la operación |
| `changed_fields` | Nombres de campos cambiados, sin duplicar sus valores sensibles |
| `request_id` | Correlación con diagnóstico seguro de la solicitud |

La aplicación no debe permitir editar o borrar eventos desde endpoints normales. No almacenar OCR, CURP, documento ni snapshots personales en la bitácora. La atomicidad de expediente+evento y el acceso de auditoría quedan por definir para la implementación.

## Pruebas locales y límites

Las pruebas nuevas usan fixtures sintéticos y mocks. Cubren proyección por rol, ausencia de datos sensibles, permisos, sesiones rechazadas, estado cargado por ID desde el servidor, estados finales, transiciones, acceso a archivos y denegación de borrado físico. No prueban las reglas PocketBase activas. Para ello se necesita una instancia de desarrollo aislada con el mismo esquema y versión, cuentas sintéticas y pruebas directas a su API.

Antes de lectura real: validar esquema/reglas/versiones, confirmar cuenta admin, aprobar identidad técnica o separación de esquema, proteger archivos, aplicar reglas solo tras revisión, probar acceso directo y vía BFF, y verificar respuesta/DTO para cada rol. Hasta entonces, la ruta sigue en 503.
