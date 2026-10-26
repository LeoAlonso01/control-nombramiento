# Diseño documentado de seguridad y persistencia

**Revisión local:** 2026-10-25

**Estado:** diseño para revisión; no se conectó PocketBase ni se creó/aplicó una migración.

## 1. Fuentes y nivel de certeza

Se encontró el archivo local `/home/leoalonso01/Documentos/Proyectos/Proyecto Nomramientos/pb_schema_nombr.json` y su nota de revisión `pb_schema_nombr.review.md`. Ambos están fuera de este repositorio. El JSON se trata como una exportación de esquema y la nota como una propuesta; ninguno demuestra cómo está configurada la instancia activa.

No se encontró otra versión JSON propuesta. La nota sí propone cambios de campos, estados y límite de archivo, pero deja sin resolver reglas, descargas protegidas, identidad de servidor, retención y varios mapeos semánticos. No se importó ni se copió el JSON.

La versión exacta del servidor PocketBase y su relación con este export siguen pendientes de confirmar en desarrollo. Las reglas que se sugieren abajo son políticas, no expresiones PocketBase listas para pegar.

## 2. Esquema observado en el JSON local

### `users` (colección auth)

- Campos de aplicación: `CURP` (texto, índice único), `nombre`, `apellido_paterno`, `apellido_materno` (texto), `activo` (bool) y `rol` (select `admin`, `auditor`, `capturista`). En el export ninguno es requerido.
- Reglas exportadas: list/view/update/delete restringidas al ID propio; `createRule` vacía; `manageRule` nula. La regla de actualización propia no limita qué campos puede enviar una persona, por lo que no protege por sí sola `rol` ni `activo`. La regla de borrado propio permite borrar la cuenta.
- Autenticación exportada: email, OAuth2 y username habilitados; `onlyVerified` deshabilitado; longitud mínima de contraseña 8; el alta pública no está restringida por la regla `createRule` exportada.
- La autenticación de la aplicación revisa `activo` y resuelve `rol` del registro renovado en servidor. No se encontró un endpoint de perfil/alta de usuarios de la aplicación.

### `nombramientos`

Campos exportados: `uuid` (texto no único), `nombre_funcionario` (texto), `cargo` (texto), `numero_nombramiento` (texto), `fecha_nombramiento` (date), `periodo_correspondiente` (texto), `fecha_recepcion` (date), `documento` (file, un archivo, máximo 5 MiB, `protected: false`), `datos_ocr` (JSON, máximo 2 000 000 bytes), `estado_ocr` (select `pendiente`, `procesando`, `completado`, `revision_manual`, `error`), `delete_at` (date), `estado_proceso` (select `pendiente`, `confirmado`, `error`) y `observaciones` (texto). Ningún campo está marcado como requerido; no hay índices exportados. Las cinco reglas de colección están vacías.

### `declaraciones`

Campos exportados: `uuid` (texto no único), `nombre_declarante` (texto), `fecha` (date), `tipo_declaracion` (select `inicio`, `modificacion`, `conclusion`, `cambio_dependencia`, `nota_aclaratoria`, `otra`), `fecha_recepcion` (date), `periodo_correspondiente` (texto), `observaciones` (texto), `documento` (file, un archivo, máximo 5 MiB, `protected: false`), `datos_ocr` (JSON, máximo 2 000 000 bytes), `delete_at` (date), `curp_declarante` (texto), `lugar_declaracion` (texto) y `estado_proceso` (select `pendiente`, `confirmado`, `error`). Ningún campo está marcado como requerido; no hay índices exportados. Las cinco reglas de colección están vacías.

En PocketBase una regla vacía permite acceso público a esa acción; `null` bloquea a los clientes ordinarios y limita la acción a superusuarios. Las reglas se omiten por completo para una solicitud autenticada como superusuario. Las descargas de campos `protected` también dependen de que se satisfaga `viewRule`.

Referencias oficiales de PocketBase:

- [API Rules and Filters](https://pocketbase.io/docs/api-rules-and-filters/)
- [Files upload and handling](https://pocketbase.io/docs/files-handling/)
- [Authentication](https://pocketbase.io/docs/authentication/)
- [JavaScript Migrations](https://pocketbase.io/docs/js-migrations/)

## 3. Matriz de correspondencia

“Campo canónico propuesto” es un contrato lógico para discutir; no confirma que se agregue o renombre un campo de PocketBase. Todos los campos exportados tienen `required: false`. Eso describe la validación del esquema, no decide qué debe estar completo para confirmar. La obligatoriedad de confirmación está pendiente de aprobación institucional en todos los casos, salvo el documento original durante la recepción, que el flujo propuesto debe exigir.

### Nombramientos

| Campo de Gemini | Campo existente en PocketBase (export) | Campo canónico propuesto | Transformación necesaria | Validación | ¿Obligatorio para confirmar? | Duda semántica pendiente |
|---|---|---|---|---|---|---|
| `numero_nombramiento` | `numero_nombramiento` (text) | `numero_nombramiento` | Recortar espacios periféricos; conservar el valor original en `datos_ocr`. | Cadena; límites de tamaño por aprobar y validar en servidor. | Pendiente de aprobación. | ¿Debe ser único? El export no tiene índice único y el contrato no declara unicidad. |
| `fecha_emision` | `fecha_nombramiento` (date) | `fecha_emision` como concepto; almacenamiento por resolver | No copiar automáticamente. Si se aprueba equivalencia, convertir fecha ISO válida al formato esperado por PocketBase. | Validar calendario real e ISO `YYYY-MM-DD`; la ruta actual de nombramientos solo comprueba tipo cadena/null. | Pendiente de aprobación. | ¿La fecha del documento es la fecha del nombramiento? No está demostrado. |
| `lugar_emision` | No existe | `lugar_emision` | Campo nuevo solo si se aprueba la necesidad. | Texto normalizado y límite aprobado. | Pendiente de aprobación. | No existe campo equivalente observado. |
| `nombre_completo` | `nombre_funcionario` (text) | `nombre_funcionario` | Mapeo acordado para revisión/almacenamiento; no separar en partes. El JSON de Gemini conserva `nombre_completo`. | Texto; validar presencia según regla de negocio aprobada. | Pendiente de aprobación. | El mapeo funcional fue indicado expresamente para esta fase; no se extiende a otros nombres/campos. |
| `cargo` | `cargo` (text) | `cargo` | Recorte periférico; mantener extracción original aparte. | Texto; límite y obligatoriedad pendientes. | Pendiente de aprobación. | Confirmar si el campo actual representa el cargo asignado en todos los expedientes. |
| `departamento` | No existe | `departamento` | Campo nuevo si se aprueba; no combinar con `dependencia`. | Texto; límite y catálogo, si aplica, por aprobar. | Pendiente de aprobación. | El prompt distingue unidad/departamento de dependencia. |
| `dependencia` | No existe | `dependencia` | Campo nuevo si se aprueba; no fusionar con `departamento`. | Texto; límite y catálogo, si aplica, por aprobar. | Pendiente de aprobación. | Debe confirmarse la clasificación institucional entre organismo y unidad. |
| `fecha_inicio` | No existe | `fecha_inicio` | Campo nuevo date si se aprueba; conservar aparte de la emisión. | Fecha ISO y calendario válido; revisar coherencia solo con reglas aprobadas. | Pendiente de aprobación. | No igualar a `fecha_emision`; el prompt permite fecha relativa solo si el texto la vincula explícitamente. |
| `tipo_nombramiento` | No existe | `tipo_nombramiento` | Campo nuevo si se aprueba; no inferir catálogo a partir de ejemplos del prompt. | Texto o catálogo por decidir. | Pendiente de aprobación. | No hay opciones de dominio en el export. |
| `observaciones` (arreglo de strings) | `observaciones` (text) | `observaciones` revisadas como texto; extracción original en `datos_ocr` | No sobrescribir el original. Si se aprueba, unir elementos con saltos de línea para el campo canónico; guardar arreglo original sin modificar en `datos_ocr`. | Cada elemento original debe ser string; límite de longitud/texto aprobado. | Pendiente de aprobación. | Confirmar separador, si se pueden editar observaciones y si se conserva historial de correcciones. |
| Objeto completo de extracción | `datos_ocr` (JSON) | `datos_ocr` | Guardar el JSON validado original de Gemini una sola vez, sin incorporar correcciones humanas. | Revalidar esquema/tipos/tamaño; el límite exportado es 2 MB. | Necesario para trazabilidad del flujo, sujeto a aprobación de retención. | Definir versiones de contrato/modelo y si se guarda metadata de modelo, sin documento ni secretos. |
| Ninguno | `uuid` (text, no único) | Clave de idempotencia aún por definir | No asumir que `uuid` es único. Puede añadirse clave con índice único y vínculo a creador o almacenarse en una operación durable separada. | UUID/token aleatorio validado; restricción única atómica. | Requisito técnico de creación idempotente, diseño pendiente. | ¿Se reutiliza `uuid` tras verificar duplicados existentes o se agrega campo nuevo? |
| Ninguno | `fecha_recepcion` (date) | `fecha_recepcion` | Si significa recepción por el sistema, generarla en servidor al crear; no tomar del navegador. | Fecha/hora del servidor y zona normalizada. | Requisito operativo propuesto; confirmar el significado de dominio. | El campo no forma parte de la extracción de nombramiento. |
| Ninguno | `estado_ocr` (select) | Sin campo canónico adicional | Mantener durante transición; no borrarlo ni escribirlo automáticamente al introducir `estado_proceso`. | Compatibilidad con valores heredados; migración futura solo con consulta y plan de transición. | No aplica al usuario; control de servidor. | El export mantiene dos campos de estado con catálogos distintos. |
| Ninguno | `estado_proceso` (select) | `estado_proceso` | Servidor controla transiciones. El export solo tiene `pendiente`, `confirmado`, `error`; la nota propone agregar `procesando`, `revision_manual`, `rechazado`. | Estado inicial y transición validada en servidor y persistencia atómica. | No editable por cliente. | La propuesta de quitar `estado_ocr` contradice la conservación segura hasta verificar datos/compatibilidad. |
| Documento original | `documento` (file, 5 MiB, no protegido) | `documento` original | Subir al expediente antes de Gemini; cambiar a protegido y 10 MiB solo mediante cambio aprobado y probado. | MIME permitido por flujo, firma, tamaño real <= 10 MiB y no vacío. | Sí para recibir/crear expediente. | Confirmar límites efectivos de Next, PocketBase y proxy; política de retención pendiente. |

### Declaraciones

| Campo de Gemini | Campo existente en PocketBase (export) | Campo canónico propuesto | Transformación necesaria | Validación | ¿Obligatorio para confirmar? | Duda semántica pendiente |
|---|---|---|---|---|---|---|
| `nombre_declarante` | `nombre_declarante` (text) | `nombre_declarante` | Recorte periférico; conservar el JSON original en `datos_ocr`. | Texto; longitud y obligatoriedad por aprobar. | Pendiente de aprobación. | Confirmar si existe un catálogo/normalización institucional de nombres. |
| `curp_declarante` | `curp_declarante` (text) | `curp_declarante` | Normalización de espacios/uso de mayúsculas solo con regla aprobada; no reconstruir caracteres. | Validación sintáctica en servidor sin “corregir” la extracción. | Pendiente de aprobación. | El prompt solo extrae CURP visible y legible; falta regla institucional de obligatoriedad. |
| `lugar_declaracion` | `lugar_declaracion` (text) | `lugar_declaracion` | Recorte periférico. | Texto; límite y obligatoriedad por aprobar. | Pendiente de aprobación. | Confirmar si se aceptan lugares libres o existe catálogo. |
| `fecha_declaracion` | `fecha` (date) | `fecha_declaracion` como nombre conceptual | No renombrar ni copiar hasta confirmar equivalencia; convertir ISO válido si se aprueba. | Fecha válida de calendario; ruta actual ya comprueba formato y calendario. | Pendiente de aprobación. | `fecha` puede referir a la declaración, pero el esquema por sí mismo no demuestra su semántica. |
| `tipo_declaracion` (seis valores acordados) | `tipo_declaracion` (select con los mismos seis valores) | `tipo_declaracion` | Valores pasan literalmente. Endpoint, tipos y formulario comparten ahora el catálogo exportado: `inicio`, `modificacion`, `conclusion`, `cambio_dependencia`, `nota_aclaratoria`, `otra`. | Lista blanca compartida en servidor; no se aceptan valores fuera del catálogo. | Pendiente de aprobación. | Se amplió el contrato según instrucción expresa de fase 2; verificar que la exportación siga siendo vigente antes de persistir. |
| `fecha_recepcion` | `fecha_recepcion` (date) | `fecha_recepcion` | Valor de extracción si el documento la declara; no reemplazarla por fecha de creación del sistema. Si se necesita timestamp de ingreso, es un dato distinto. | Validar fecha; la ruta actual valida formato/calendario. | Pendiente de aprobación. | Distinguir fecha documental de recepción técnica del archivo. |
| Ninguno | `periodo_correspondiente` (text) | Sin mapeo en extracción | No completar automáticamente. | No aplica hasta definir origen. | Pendiente de aprobación. | No existe en contrato Gemini/UI. |
| Ninguno | `observaciones` (text) | `observaciones` revisadas | No hay campo en extracción actual; no inventar contenido ni transformar otro dato. | Texto introducido por usuario, con validación de longitud tras definir el límite. | Pendiente de aprobación. | Decidir si se agrega observación al formulario/contrato o se mantiene fuera de esta captura. |
| Objeto completo de extracción | `datos_ocr` (JSON) | `datos_ocr` | Guardar el JSON validado original sin correcciones. | Esquema exacto, valores enum y límite de 2 MB validados en servidor. | Trazabilidad propuesta; retención por aprobar. | Definir cómo versionar el contrato cuando se habiliten los otros tipos. |
| Ninguno | `uuid` (text, no único) | Clave de idempotencia aún por definir | Mismo problema que nombramientos: no depender de un campo no único. | Índice/operación durable atómica. | Requisito técnico propuesto, diseño pendiente. | Revisar valores existentes antes de promover a único. |
| Documento original | `documento` (file, 5 MiB, no protegido) | `documento` original | Persistir antes de llamar a Gemini y servirlo solo tras autorización por expediente. | PDF/JPEG/PNG según reglas actuales; firma real, no vacío, máximo 10 MiB propuesto. | Sí para recibir/crear expediente. | El esquema exportado aún permite 5 MiB y descarga no protegida. |

### Propuesta de campos obligatorios al confirmar

El export marca todos los campos como opcionales. Esta propuesta busca permitir identificar el expediente y a la persona sin convertir todas las salidas OCR en requisitos. No se aplica en código y requiere aprobación funcional/institucional:

| Tipo | Propuesta mínima para confirmar | Justificación | Lo que queda opcional hasta aprobación |
|---|---|---|---|
| Nombramiento | `nombre_funcionario`, `cargo` y presencia del documento original | Identifica a la persona nombrada, el puesto y mantiene la fuente documental revisable. | Número/fechas, lugar, departamento, dependencia, tipo y observaciones; no se exige fecha hasta resolver `fecha_emision` vs `fecha_nombramiento`. |
| Declaración | `nombre_declarante`, `tipo_declaracion` y presencia del documento original | Identifica a la persona, clasifica el trámite dentro del catálogo acordado y conserva la evidencia. | CURP, lugar y fechas; no se exige `fecha` hasta validar su equivalencia con `fecha_declaracion`. |

El documento es obligatorio para recibir un expediente, no se propone borrarlo al confirmar/rechazar ni se le asigna plazo de retención. La política de conservación requiere aprobación separada.
| Ninguno | `estado_proceso` (select) | `estado_proceso` | El servidor controla las transiciones; la nota propone ampliar de `pendiente`, `confirmado`, `error` a los seis estados del flujo. | Rechazar estados enviados por el cliente y transiciones inválidas. | No editable por cliente. | Confirmar si `revision_manual`, `procesando` y `rechazado` son valores aprobados. |

## 4. Reglas de autorización que debe implementar el diseño

El estado del JSON local es inseguro para colecciones de expedientes: las cinco reglas de cada colección están vacías. Para `users`, el alta está abierta; las cuentas pueden actualizar y borrar su propio registro. Las reglas observadas no están probadas contra la instancia activa.

Política objetivo (no expresión ejecutable todavía):

| Colección/operación | Clientes normales | Servicio de servidor |
|---|---|---|
| Nombramientos/declaraciones list y view | `admin`, `capturista`, `auditor` autenticados y activos; cada listado y detalle filtra todos los registros que la regla permite. Archivo protegido solo accesible si view se satisface. | Acceso estrictamente necesario para los endpoints; cada petición Next verifica primero sesión y permiso de la persona usuaria. |
| Nombramientos/declaraciones create/update/delete | Bloqueadas en PocketBase para los tokens de usuarios finales; no existe endpoint genérico de mutación. | Solo operaciones de flujo específicas, con validación de estado/campos y actor. |
| Users list/view | Solo perfil propio para autenticación de aplicación; no exponer listas de cuentas. | Lectura mínima necesaria para autenticar y resolver actividad/rol. |
| Users create/update/delete | Alta pública y cambios de `rol`/`activo` bloqueados; no hay perfil editable implementado. | Alta/cambios administrativos mediante mecanismo expresamente aprobado y lista blanca. |

Las reglas de PocketBase son filtros y no controles de campos. Una regla de actualización propia no basta para impedir cambiar `rol` o `activo`. Hasta contar con una ruta de perfil autorizada, bloquear actualización/borrado de `users` para clientes normales evita escalación. Mantener login/recuperación solo tras probar que el bloqueo de registro no invalida los flujos institucionales aprobados.

## 5. Rutas y transiciones propuestas

Todas las rutas de escritura deben invocar `getVerifiedSessionContext(request.headers.get("cookie"))` (o una puerta común equivalente) y autorizar con el rol resuelto en el servidor y `hasPermission`. No aceptar rol, estado final, creador ni permisos del cuerpo. No cachear respuestas de expedientes ni de documentos. No crear endpoints genéricos `PATCH`/`DELETE`.

| Método/ruta propuesta | Permisos | Comportamiento de servidor |
|---|---|---|
| `GET /api/nombramientos` y `/api/declaraciones` | `read`: admin/capturista/auditor activos | Lista paginada con filtro validado y campos mínimos; no devuelve URLs públicas del documento. |
| `GET /api/{coleccion}/[id]` | `read`: los tres roles | Verifica registro y permiso; nunca confía en ID como autorización. |
| `POST /api/{coleccion}` | `create`: admin/capturista | Multipart; validar origen, sesión, archivo vacío/tamaño/MIME/firma y clave de idempotencia; crear expediente `pendiente` con documento antes de llamar Gemini. Creador y clave deben quedar vinculados de forma verificable. |
| `POST /api/{coleccion}/[id]/extraer` | admin/capturista; solo estado/reintento permitido | Transición atómica a `procesando`, Gemini, guardar JSON original en `datos_ocr`; pasar a `revision_manual` si válido o `error` si falla. El documento creado no se elimina en el fallo. |
| `POST /api/{coleccion}/[id]/reintentar` | admin/capturista; solo `error` | Reutiliza expediente/documento existente; operación idempotente, no crea otro expediente ni pisa correcciones. |
| `POST /api/{coleccion}/[id]/confirmar` | admin/capturista; solo `revision_manual` | Acepta exclusivamente campos canónicos permitidos; valida reglas de negocio aprobadas en servidor; persiste datos revisados y `confirmado` atómicamente con auditoría. El cliente no elige estado. |
| `POST /api/{coleccion}/[id]/rechazar` | admin/capturista; solo `revision_manual` | Valida motivo requerido si la institución lo aprueba; guarda rechazo/actor/fecha en operación auditable y `rechazado` atómicamente. |
| `GET /api/{coleccion}/[id]/documento` | `read` más acceso al expediente | Verifica acceso y devuelve el archivo por proxy autenticado o URL/token protegido muy breve; evitar URL pública permanente. No guardar el token en logs/respuesta durable. |

El auditor no tiene rutas de mutación; llamadas directas a endpoints de confirmación/rechazo deben devolver 403 antes de leer o escribir el cuerpo. Administrador y capturista pueden confirmar/rechazar solo por endpoint dedicado y solo en estado válido.

### Idempotencia y concurrencia

El export tiene `uuid` en texto, sin índice único ni relación de creador. No es suficiente para deduplicar de forma atómica. Diseño a resolver antes de crear endpoints:

1. Añadir campo de idempotencia de alta y campo/relación `created_by` (o un registro durable equivalente) con restricción única apropiada, después de revisar duplicados existentes; o
2. Implementar el registro y las operaciones de idempotencia/transiciones dentro de un backend PocketBase con transacciones e índices verificados.

El cliente puede enviar una clave aleatoria para reintentos, pero el servidor debe validarla, ligarla a la persona autenticada, y una restricción durable debe arbitrar carreras. Un `useRef`, un bloqueo en memoria o una consulta “buscar y después crear” no resuelve concurrencia entre procesos. Las transiciones y su evento de auditoría deben confirmarse como una sola unidad durable; la API CRUD por sí sola no se toma como compare-and-swap.

### Auditoría propuesta

El export no contiene colección de auditoría. Se recomienda una colección separada (nombre provisional `auditoria_expedientes`) con identificador de colección/expediente, actor verificado, acción, estado anterior/nuevo, fecha de servidor, motivo de rechazo cuando se apruebe, y resultado/código controlado. No registrar documento, OCR completo, contraseña, token, clave API ni datos personales innecesarios. Las personas usuarias no tendrían create/update/delete; la escritura sería solo del mecanismo de servidor. Debe definirse append-only en reglas y probarse contra el mecanismo elegido: una API rule no crea inmutabilidad frente a superusuarios. No se debe fijar retención de auditoría sin política institucional.

## 6. Cliente de escritura y credenciales

Lo encontrado hoy: `createPocketBaseServer(cookieHeader)` crea un SDK aislado por petición y carga la cookie de la persona usuaria; `getVerifiedSessionContext` ejecuta `authRefresh` sobre esa sesión y devuelve el mismo cliente. Login también autentica por contraseña en `users`. No se encontró autenticación de servicio ni credencial privilegiada en el cliente de PocketBase. No se leyó ningún archivo `.env`.

Alternativas, sin conexión remota:

1. **Preferible si se autoriza mantener código del servidor PocketBase:** endpoint/extension Go que valida operaciones, roles, transacciones y auditoría junto a la base de datos. Next.js reenvía identidad verificable y el servidor aplica política; requiere plan de despliegue/mantenimiento de esa extensión.
2. **Identidad técnica dedicada y acotada:** colección/cuenta de servicio que no pueda usarse como persona usuaria y reglas exactas limitadas a escrituras requeridas. Mantener su secreto solo en servidor. Requiere diseñar cómo se autentica, cómo se renueva y cómo se impide que el cliente obtenga su token; el esquema exportado no contiene esa identidad.
3. **Credencial `_superusers` solo en servidor:** SDK independiente por petición/proceso controlado, credencial fuera de Git y sin prefijo público; verificar sesión/rol/estado/propiedad/transición/campos en cada endpoint. PocketBase omite todas las API rules para superusuarios, así que un error de autorización tendría alto impacto. No hay mecanismo implementado actualmente; requiere aprobación expresa de arquitectura y configuración local segura.

No se recomienda reutilizar un SDK global con `authStore` mutable entre solicitudes de usuarios. Ninguna alternativa se implementa en esta fase; no solicitar ni copiar secretos.

## 7. Archivos y migración: propuesta condicionada

PocketBase documenta que un archivo es descargable con su URL conocida si no es `protected`; el acceso protegido requiere token breve y una `viewRule` que autorice al usuario. La exportación observada declara `protected: false`, así que no es aceptable para documentos confidenciales. La nota propuesta no cambia aún esta opción.

Base de migración que podría derivarse del export, **solo después de compararlo con una exportación de desarrollo actual, verificar versión exacta, respaldo y datos heredados**:

- Ambas colecciones: reglas de lista/ver de acuerdo con la matriz y reglas de escritura bloqueadas para personas usuarias; `documento` `protected: true`, un archivo, MIME allowlist por colección y máximo 10 MiB; mantener `datos_ocr` JSON.
- Ambas colecciones: agregar a `estado_proceso` los estados aprobados que falten (`procesando`, `revision_manual`, `rechazado`); el export actual ya tiene `pendiente`, `confirmado`, `error`.
- Nombramientos: agregar opcionalmente `lugar_emision`, `departamento`, `dependencia`, `fecha_inicio`, `tipo_nombramiento`, como propone la nota externa, si se aprueba el modelo. Conservar `fecha_nombramiento` y `nombre_funcionario`; no renombrar/copiar semánticamente hasta tener aprobación.
- Nombramientos: conservar `estado_ocr` durante la transición. La nota externa propone eliminarlo, pero no existe consulta de uso/valores heredados ni plan de backfill que justifique borrarlo.
- Ambas colecciones: considerar `idempotency_key`, `created_by` y una colección de auditoría protegida/append-only. No están en el export, así que sus tipos, reglas, índices y retención requieren diseño antes de generar una migración.
- Users: bloquear alta/actualización/borrado de cliente, sin alterar opciones de autenticación hasta validar login y recuperación; si se autoriza edición de perfil, agregar endpoint de campos permitidos y validaciones explícitas.
- No usar `delete_at` ni quitar campos/valores existentes. La nota externa dice conservar reglas y esquema de users tal como exportados, pero esas reglas incluyen las condiciones inseguras descritas arriba; no importarla sin revisión.

Esto es un plan de cambios aditivos y endurecimiento sujeto a revisión, no un archivo de migración listo para aplicar. El export puede estar desfasado y agregar índices únicos requiere comprobar colisiones antes.

### Procedimiento futuro para una instancia aislada

1. Obtener la versión exacta del ejecutable PocketBase usado en desarrollo y un respaldo/snapshot de desarrollo autorizado; no usar la URL ni el directorio de datos de la instancia activa.
2. Crear un directorio temporal nuevo, confirmar que no sea enlace al directorio real de datos y restaurar allí una copia desechable. Restringirlo al usuario local y no guardar credenciales en el repositorio.
3. Revisar el esquema y los datos de esa copia; comprobar precondiciones de índices/valores antes de ejecutar cualquier cambio. Mantener el JSON exportado como referencia, sin importarlo directamente.
4. Colocar la migración revisada en `pb_migrations` del proyecto PocketBase de prueba. Ejecutar `pocketbase migrate up` usando explícitamente el directorio temporal y el binario de la versión verificada. PocketBase documenta que las migraciones unapplied se ejecutan en una transacción y ofrece `migrate up`/`migrate down`; cada migration debe tener cambios de esquema/data dentro de la transacción y no realizar efectos externos.
5. Verificar campos, reglas, índices, estado de archivos protegidos, tamaño máximo, filas heredadas y flujo de autenticación/lectura/escritura con usuarios ficticios para cada rol. Comprobar una segunda ejecución de `migrate up` para confirmar que no repite cambios.
6. Probar `migrate down 1` solo en esa copia y revisar el esquema/datos restaurados. No usar un rollback que borre datos nuevos; en una prueba con datos de expediente, restaurar el respaldo limpio en vez de descartar documentos.
7. Destruir el directorio temporal únicamente después de verificar que es desechable y guardar los reportes sin datos personales ni secretos.

La sintaxis exacta de flags/directorio debe seguir la versión de PocketBase confirmada; no se ha generado ni ejecutado una migración en esta fase. Referencia: [PocketBase JavaScript Migrations](https://pocketbase.io/docs/js-migrations/).

## 8. Conservación y eliminación

- Guardar el original antes de invocar Gemini. Mantenerlo durante revisión, confirmado, rechazado y error/reintento; un fallo de extracción cambia estado, no borra archivo.
- No programar ni ejecutar borrado automático. `delete_at` existe en el export, pero su semántica no está definida; dejarlo sin uso.
- La institución debe aprobar: plazo/criterio de retención por estado y tipo documental, archivo histórico, suspensión por auditoría/litigio, autoridad que puede disponer eliminación, doble aprobación si corresponde y tratamiento de respaldos.
- Después de esa aprobación, implementar una operación de eliminación separada, con permiso administrativo explícito, previsualización/lista de impacto, motivo, identidad y fecha, registro de auditoría inmutable, confirmación de borrado del archivo y metadatos, y prueba de restauración/verificación de respaldos. No diseñar TTL ni calendario antes de recibir política.

## 9. Pruebas y comandos locales

Se encontró Node `v22.23.4` instalado mediante NVM en `/home/leoalonso01/.nvm/versions/node/v22.23.4/bin/node`. El binario de Snap sigue apareciendo primero en `PATH` y `npm`/`npx` directos intentan Snap; invocar Node de NVM por ruta absoluta y los CLI ya instalados evita instalar o actualizar paquetes.

Desde `frontend`, usando el binario absoluto:

```bash
/home/leoalonso01/.nvm/versions/node/v22.23.4/bin/node node_modules/typescript/bin/tsc --noEmit
/home/leoalonso01/.nvm/versions/node/v22.23.4/bin/node node_modules/eslint/bin/eslint.js
/home/leoalonso01/.nvm/versions/node/v22.23.4/bin/node --test tests/security/auth-policy.test.mjs tests/security/record-contract.test.mjs
PATH="$(pwd)/node_modules/.bin:/home/leoalonso01/.nvm/versions/node/v22.23.4/bin:/usr/bin:/bin" /home/leoalonso01/.nvm/versions/node/v22.23.4/bin/node node_modules/next/dist/bin/next build --webpack
```

Comprobaciones ejecutadas en esta revisión:

- TypeScript: `tsc --noEmit`, salida 0.
- ESLint: salida 0.
- Suites `tests/security/auth-policy.test.mjs` y `tests/security/record-contract.test.mjs`: salida 0; la segunda cubre también transiciones y extensión engañosa.
- Build: no completado. Se retiró la descarga de Geist, pero Turbopack falla con `Operation not permitted` al crear su proceso de CSS que enlaza un puerto. El intento Webpack también falla porque Next no puede lanzar el proceso hijo de TypeScript (`spawnSync ... EPERM`) y recibe salida vacía en `tsc --showConfig`. Se repitió fuera del sandbox sin resolver el bloqueo.
- `git diff --check`: salida 0.

`frontend/package.json` y `package-lock.json` fijan Next.js `16.4.0`; el `node_modules` existente contiene `16.4.3` (verificado leyendo su package metadata y la salida del build). La instalación local no corresponde al lockfile. No se ejecutó `npm ci` ni se tocaron dependencias: borraría/reemplazaría `node_modules` y puede requerir red. Los resultados de compilación de Next no representan la versión declarada.

Las pruebas añadidas cubren correspondencia de nombre/fechas, observaciones, validación JSON y fechas, seis tipos de declaración, metadatos/tamaño/extensión/firmas de archivos y transiciones permitidas. Cuando se implemente el flujo, aún faltan pruebas de endpoints con sesión anónima/inactiva, lector auditor intentando mutar, escalación de usuario, concurrencia/idempotencia durable, error/reintento Gemini conservando documento, confirmación completa/incompleta, archivos protegidos/descargas, ausencia de secretos/logs y migración/reversión contra instancia desechable. Las pruebas de migración nunca deben usar producción.

## 10. Decisiones, responsables y plan

| Decisión pendiente | Aprobación/insumo necesario |
|---|---|
| Si el export y la nota corresponden a una versión vigente; obtener versión y export actual de PocketBase de desarrollo | Responsable técnico de PocketBase |
| Equivalencia de `nombre_completo`/`nombre_funcionario`, `fecha_emision`/`fecha_nombramiento`, `fecha_declaracion`/`fecha`; campos obligatorios por confirmación | Responsable funcional de nombramientos/declaraciones |
| Catálogo de `tipo_declaracion`, obligatoriedad de `tipo_nombramiento`, semántica de `observaciones` | Responsable funcional |
| Campos de creador, clave idempotente y modelo/eventos de auditoría | Arquitectura y seguridad de aplicación |
| Identidad privilegiada: extensión PocketBase, cuenta técnica acotada o superusuario de servidor | Responsable de PocketBase y seguridad; nunca enviar secretos |
| Activación de `protected`, reglas de usuario y colecciones, MIME, 10 MiB y límites de proxy | Responsable de PocketBase/infraestructura |
| Retención, archivo y eliminación | Autoridad institucional de datos/archivo y área jurídica correspondiente |
| Reglas de doble aprobación y motivo de rechazo | Responsable de proceso |

Fases de trabajo:

1. Comparar export con esquema de instancia de desarrollo y confirmar decisiones de campos, roles y retención.
2. Aprobar contrato canónico y reglas de negocio; definir idempotencia, transacciones y auditoría.
3. Escribir migración versionada aditiva; preservar `estado_ocr` y datos; probarla y revertirla en instancia desechable.
4. Implementar servicio de escritura en servidor con autorización por endpoint, archivo protegido y transiciones atómicas; agregar pruebas negativas y de concurrencia.
5. Integrar las pantallas con creación persistente, revisión, confirmación, rechazo y reintento. Quitar simulaciones solo al probar el flujo equivalente.
6. Verificar límites de carga, recuperación/retención y procedimiento de respaldo/restauración. Cualquier despliegue o cambio remoto requiere autorización separada.

## 11. Implementación local y estado de Git

Se implementó un contrato local puro para validar la extracción de nombramientos, mapear `nombre_completo` a `nombre_funcionario` y normalizar observaciones a texto sin mutar el arreglo original. `fecha_emision` y `fecha_inicio` siguen separadas; no se crea `fecha_nombramiento`. Las rutas de extracción reutilizan validación de MIME/tamaño/firma; la validación del endpoint de nombramientos también rechaza fechas ISO imposibles. El catálogo de tipos de declaración ahora se comparte entre extractor, UI y pruebas. Se añadió el contrato puro de transiciones esperado.

Esto mejora contratos y comprobaciones locales, pero **no es persistencia**: las rutas todavía devuelven la extracción al cliente, no guardan `datos_ocr` ni documento, y las decisiones de captura siguen simuladas. No se retiró ninguna simulación ni se implementó endpoint de expediente porque no se ha validado el esquema activo ni un mecanismo seguro de escritura.

El build con Geist fue sustituido por una pila tipográfica sans del sistema para evitar descarga durante build. No se añadieron dependencias. Se preserva el cambio preexistente `frontend/app/dashboard-client.tsx`. Se actualizaron los docs locales y se añadieron contratos y pruebas; no se tocó `package.json`, lockfile, base de datos, esquema ni servicios.
