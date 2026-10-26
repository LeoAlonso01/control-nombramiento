# Diagnóstico y plan: seguridad y persistencia

## Alcance de esta revisión

Se inspeccionó el estado Git, la configuración del frontend, la autorización, la sesión y el cliente de PocketBase, las rutas de extracción, las pantallas de captura y las pruebas existentes. No se consultó una instancia de PocketBase ni se modificaron datos, reglas, servicios o infraestructura.

La rama estaba en `main` y ya tenía un cambio local en `frontend/app/dashboard-client.tsx` al comenzar la revisión. Ese cambio se conserva intacto.

## Diagnóstico observado

- Next.js usa PocketBase para autenticar usuarios. El servidor renueva la sesión contra `users`, comprueba `activo` y calcula el rol con el registro verificado y el identificador administrativo configurado.
- La matriz central da lectura general a `auditor`, pero no incluye acciones específicas de confirmar o rechazar. Las rutas actuales de extracción autorizan `create` a `admin` y `capturista`; no existen rutas de listar, ver, actualizar, confirmar o rechazar expedientes.
- Las rutas `/api/nombramientos/extraer` y `/api/declaraciones/extraer` validan sesión, rol, tamaño máximo de 10 MiB, MIME y firma, y después envían el documento a Gemini. Devuelven los datos extraídos al cliente; no escriben expedientes ni archivos en PocketBase.
- Las pantallas permiten revisar campos, pero las etapas de admisión y rechazo solo actualizan estado local. Los identificadores `SIM-*` y los mensajes de guardado simulado no corresponden a operaciones persistidas.
- En fase 2 se añadió validación compartida del JSON extraído de nombramientos, mapeo editable de `nombre_completo` a `nombre_funcionario`, normalización de observaciones, validación de fechas ISO y utilidades compartidas de validación de archivos. Se sincronizó el catálogo de seis tipos de declaración entre extractor y formulario y se añadió un contrato puro de transiciones. Estos cambios no persisten expedientes ni reemplazan la simulación de decisiones.
- El repositorio no contiene migraciones de PocketBase ni una exportación de esquema. Se encontró fuera del repositorio `pb_schema_nombr.json` y `pb_schema_nombr.review.md`; su contenido está analizado en [security-persistence-design.md](security-persistence-design.md). Son una exportación y una nota propuesta, no evidencia del esquema activo. El SDK instalado no permite deducir la versión del servidor.
- La exportación local describe campos y reglas para `nombramientos`, `declaraciones` y `users`, pero no demuestra su estado en la instancia activa ni su compatibilidad con datos existentes. En esa exportación ambas colecciones de expedientes tienen reglas vacías y archivos de 5 MiB con `protected: false`; la colección `users` permite alta pública y actualización/borrado propios. Son hallazgos del archivo, no de una instancia consultada.
- Las pruebas cubren autorización/sesión, extracción no autorizada, contratos y mapeos de campos, observaciones, fechas, catálogo de tipos, tamaños/firmas de archivo y transiciones. No cubren persistencia real, concurrencia durable, descargas protegidas ni migraciones.
- `README.md` aún describe una arquitectura anterior (SvelteKit, FastAPI y PostgreSQL), mientras que `frontend/README.md` es la plantilla inicial de Next.js.
- `node`, `npm` y `npx` del `PATH` usan Snap, que no puede iniciarse en este entorno. Node `v22.23.4` de NVM invocado por ruta absoluta ejecuta TypeScript, ESLint y las suites locales. Se retiró `next/font/google` para no descargar Geist durante el build; la compilación sigue bloqueada porque Turbopack/Next necesitan crear procesos hijos que el entorno deniega (`EPERM`).
- `package.json` y lockfile declaran Next.js `16.4.0`, pero el `node_modules` existente contiene `16.4.3`; no se actualizaron dependencias ni se reemplazó `node_modules`.

## Riesgos y bloqueos

1. Una migración escrita sin esquema y versión reales puede fallar o cambiar datos/reglas incompatibles.
2. Persistir campos adivinados puede truncar, omitir o asignar incorrectamente información institucional. En particular, no se puede asumir equivalencia entre `fecha_emision` y `fecha_nombramiento`, `nombre_completo` y `nombre_funcionario`, ni entre `fecha_declaracion` y `fecha`.
3. El prompt de nombramientos entrega `observaciones` como arreglo; no se verificó el tipo almacenado. La pantalla actualmente edita esas observaciones como texto.
4. No se definió qué tipos de declaración acepta la colección existente ni su equivalencia con `inicio`, `modificacion` y `conclusion`.
5. La retención del documento original y los documentos rechazados o con error requiere una política institucional. No se añadirá borrado automático ni una política supuesta.
6. Las rutas actuales no disponen de una estrategia verificada para realizar escrituras privilegiadas en PocketBase. No se introducirán credenciales administrativas ni secretos nuevos como parte de una suposición.
7. Los límites efectivos de cuerpo de Next.js y de cualquier proxy/PocketBase no se pudieron contrastar con una configuración de desarrollo desplegada.

## Plan por fases

1. **Inventario validado:** obtener esquema de desarrollo y versión exacta de PocketBase; identificar tipos, reglas, campos protegidos, índices y datos heredados. Confirmar los mapeos semánticos y los tipos de declaración.
2. **Contrato y pruebas:** definir transiciones válidas, campos canónicos, separación entre extracción original y correcciones, idempotencia y estrategia de auditoría. Añadir pruebas unitarias para autorización, validación de archivos, estados, duplicados y ausencia de fugas.
3. **Migración revisable:** preparar migración versionada que preserve compatibilidad y documente reversión. Probarla únicamente en una instancia local de desarrollo con datos desechables y copia restaurable.
4. **Persistencia del servidor:** implementar una capa de PocketBase de servidor con identidad verificada, permisos explícitos para cada operación y escritura privilegiada confinada al servidor. Añadir creación, extracción, revisión, confirmación, rechazo, reintento y descarga protegida.
5. **Integración de interfaz:** sustituir las confirmaciones locales solo después de que los endpoints equivalentes estén implementados y probados. Mantener revisión humana y distinguir los datos OCR originales de las correcciones.
6. **Verificación y operación:** ejecutar pruebas, tipos, lint y build; documentar límites de carga que requieren ajuste y un procedimiento de respaldo, migración, validación y reversión para desarrollo. No aplicar nada a producción sin autorización explícita.

## Insumos necesarios para continuar sin inventar el esquema

- Exportación o snapshot del esquema de una instancia **de desarrollo**, incluyendo versión exacta del servidor y las colecciones `users`, `nombramientos` y `declaraciones` (campos, tipos, opciones, reglas, índices y configuración `protected`). No enviar tokens, claves ni credenciales.
- Confirmación del mapeo institucional para los pares de nombres/fechas señalados y para `observaciones`, y la lista de tipos de declaración admitidos.
- Política aprobada de conservación de documentos originales, incluidos expedientes rechazados y fallidos; hasta entonces no se implementará eliminación automática.
- Método autorizado para que el servidor de desarrollo escriba en PocketBase y descargue documentos protegidos, con los secretos configurados localmente fuera del repositorio. No se requieren ni se deben compartir valores secretos.
- Configuración de desarrollo del límite de carga de Next.js/PocketBase/proxy, o autorización para medirla en un entorno local aislado.

## Verificaciones de esta fase

- Revisión estática de archivos y estado Git: completada.
- TypeScript (`tsc --noEmit`): salida 0 con Node de NVM `v22.23.4` y dependencias ya instaladas.
- ESLint: salida 0 con el CLI ya instalado.
- Suites `tests/security/auth-policy.test.mjs` y `tests/security/record-contract.test.mjs`: salida 0 con `node --test`.
- Build: no completado. Turbopack falla al enlazar un puerto para crear su proceso CSS; el intento Webpack falla porque Next no puede lanzar su proceso TypeScript (`spawnSync ... EPERM`) y no puede analizar `tsc --showConfig`.
- Migraciones y reglas: no creadas ni aplicadas; falta confirmar que la exportación local coincida con desarrollo y la versión del servidor.
- Instancia remota, datos, servicios e infraestructura: no consultados ni modificados.

Consulta la [matriz, diseño de endpoints, estrategia de escritura, retención y plan por fases](security-persistence-design.md) para el análisis actualizado.
