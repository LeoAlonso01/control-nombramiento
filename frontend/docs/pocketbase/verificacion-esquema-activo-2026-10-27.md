# Verificación del esquema y permisos activos de PocketBase

Fecha: 2026-10-27  
Destino revisado: `https://investigacion.tail2a6709.ts.net`  
Alcance: lectura de salud y metadatos. No se consultaron registros ni archivos.

## Resultado

No fue posible comparar el esquema exportado con el esquema activo. La consulta anónima de `GET /api/collections` respondió **HTTP 401**. No se intentó autenticar, eludir el control de acceso ni repetir la consulta con credenciales. La verificación completa de campos, reglas, archivos, roles y permisos debe realizarla una persona administradora desde el panel de PocketBase.

La llamada a `GET /api/health` durante esta revisión terminó con un error de red/TLS desde el entorno de ejecución. En la fase anterior se había reportado una respuesta HTTP 200 desde Windows; esta ejecución no pudo repetirla, por lo que aquí queda como antecedente reportado, no como confirmación nueva.

## Datos confirmados en esta revisión

- El endpoint de metadatos `/api/collections` exige autorización en esta sesión (HTTP 401).
- El SDK declarado e instalado localmente es `pocketbase@0.21.5`.
- `frontend/.env.local` está excluido por `frontend/.gitignore`.
- No se consultaron colecciones de usuarios, registros de nombramientos/declaraciones ni archivos.
- No se realizaron cambios remotos.

La versión PocketBase `v0.22.18` es la versión observada que indicó el usuario; no pudo comprobarse en esta sesión mediante metadatos autorizados.

## Información que solo consta en `pb_schema_current.json`

El archivo exportado contiene dos colecciones base. Sus reglas aparecen como cadenas vacías en el export; esto no confirma que el estado activo sea el mismo. En PocketBase las reglas vacías suelen representar acceso público, por lo que el administrador debe verificarlo expresamente antes de implementar persistencia.

| Colección | Campo | Tipo | Opciones exportadas |
|---|---|---|---|
| `declaraciones` | `uuid` | text | — |
|  | `nombre_declarante` | text | — |
|  | `fecha` | date | — |
|  | `tipo_declaracion` | select | `inicio`, `modificacion`, `conclusion`, `cambio_dependencia`, `nota_aclaratoria`, `otra` |
|  | `fecha_recepcion` | date | — |
|  | `periodo_correspondiente` | text | — |
|  | `observaciones` | text | — |
|  | `documento` | file | `maxSelect=1`; `maxSize=5,242,880` bytes; sin MIME allowlist; `protected=false` |
|  | `datos_ocr` | json | `maxSize=2,000,000` bytes |
|  | `delete_at` | date | — |
|  | `curp_declarante` | text | — |
|  | `lugar_declaracion` | text | — |
|  | `estado_proceso` | select | `pendiente`, `confirmado`, `error` |
| `nombramientos` | `uuid` | text | — |
|  | `nombre_funcionario` | text | — |
|  | `cargo` | text | — |
|  | `numero_nombramiento` | text | — |
|  | `fecha_nombramiento` | date | — |
|  | `periodo_correspondiente` | text | — |
|  | `fecha_recepcion` | date | — |
|  | `documento` | file | `maxSelect=1`; `maxSize=5,242,880` bytes; sin MIME allowlist; `protected=false` |
|  | `datos_ocr` | json | `maxSize=2,000,000` bytes |
|  | `estado_ocr` | select | `pendiente`, `procesando`, `completado`, `revision_manual`, `error` |
|  | `delete_at` | date | — |
|  | `estado_proceso` | select | `pendiente`, `confirmado`, `error` |
|  | `observaciones` | text | — |

El export muestra reglas `listRule`, `viewRule`, `createRule`, `updateRule` y `deleteRule` vacías para ambas colecciones; no muestra índices definidos. Estos valores son **solo del archivo** y no se validaron contra la instancia activa.

## Sin verificar en la instancia activa

- Versión exacta del servidor PocketBase.
- Existencia, nombres, tipos y opciones de todos los campos y selects.
- Reglas actuales de listado, consulta, creación, actualización y eliminación.
- Estado `protected` de archivos, límite de tamaño y tipos MIME admitidos.
- Índices de colecciones.
- Configuración de roles, campo/atribución de rol, estado activo y permisos efectivos.
- Si `delete_at`, `datos_ocr` y `documento` existen con las opciones del export.

## Comprobación manual requerida en el panel

Una persona administradora debe revisar, sin exportar ni abrir registros reales:

1. La versión mostrada por la instancia y el tipo/identidad de las colecciones `declaraciones` y `nombramientos`.
2. En cada colección, los nombres, tipos y opciones de campos, con atención a `delete_at`, `datos_ocr`, `documento` y los valores de los campos select.
3. Las cinco reglas (`listRule`, `viewRule`, `createRule`, `updateRule`, `deleteRule`) y los índices.
4. Para `documento`, `protected`, `maxSize`, `maxSelect` y MIME types.
5. La colección de autenticación y la configuración que determina roles, cuenta activa y permisos de administrador, capturista y auditor. No hace falta consultar registros de usuarios.

Después, se puede comparar esos valores manuales con `pb_schema_current.json` y registrar diferencias antes de autorizar cualquier escritura. Este informe no autoriza cambios al esquema ni a las reglas.

## Verificaciones locales

Resultados ejecutados en esta fase:

- `npm run lint`: correcto.
- `npx tsc --noEmit`: correcto.
- `node --experimental-strip-types --test tests/security/auth-policy.test.mjs tests/security/record-contract.test.mjs tests/security/pocketbase-target.test.mjs tests/security/pocketbase-connection.test.mjs`: 45 aprobadas, 0 fallidas.
- `npm run build`: correcto.

Node emitió avisos de `--experimental-strip-types` y de detección de módulos durante las pruebas; no causaron fallos. Las pruebas locales no usan credenciales administrativas.
