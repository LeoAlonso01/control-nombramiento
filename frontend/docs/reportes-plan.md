# Plan del módulo de reportes

Fecha: 2026-11-09. Alcance: revisión local y propuesta; sin consultas a registros ni cambios a la integración, infraestructura o base de datos.

Actualización: la implementación inicial posterior a esta propuesta está documentada en [reportes-implementacion.md](reportes-implementacion.md), incluidas las decisiones autorizadas, verificaciones y pendientes. Este documento conserva el diagnóstico y plan originales.

## Diagnóstico

- `app/(sistema)/reportes/page.tsx` contiene estados vacíos, cuatro indicadores sin valores, filtros de fecha deshabilitados y exportación sin implementar. No calcula datos ficticios ni reales.
- Existen GET autenticados en `app/api/nombramientos/route.ts` y `app/api/declaraciones/route.ts`, repositorios paginados en `lib/records/` y cliente aislado por petición en `lib/pocketbase/server.ts`. Se debe reutilizar esa verificación de sesión y autorización.
- Los listados excluyen `delete_at`, filtran `periodo_correspondiente` y `estado_proceso`, pero no reciben un rango de fechas. Su límite de 100 por página impide usar una sola página para calcular totales completos.
- Los contratos de los repositorios advierten que son provisionales. `docs/pocketbase/verificacion-esquema-activo-2026-10-27.md` no confirma el esquema ni las reglas activas. Los informes anteriores de ausencia de endpoints están desactualizados frente al código actual.
- El export contiene `pendiente`, `confirmado`, `error` en `estado_proceso`. `lib/records/workflow.ts` define seis estados y `estado_ocr` tiene otro catálogo. No deben mezclarse ni asumir que confirmado equivale a concluido.
- La captura de nombramientos envía la fecha etiquetada como emisión a `fecha_recepcion`, y la fecha de inicio a `fecha_nombramiento`. Debe aclararse esa semántica antes de llamar al análisis «recepciones».
- No hay dependencias específicas de gráficos, XLSX o PDF en `package.json`. Se conserva npm y `package-lock.json`; seleccionar dependencias después de definir formatos y volumen, sin instalar en esta fase.

## Viabilidad y límites

Es viable implementar estadísticas de los registros autorizados en las colecciones existentes, sin crear colecciones para la primera versión, sujeto a validar esquema activo y fechas. Los resultados representan expedientes, no personas únicas. No hay evidencia suficiente de un historial de transiciones: no se puede reconstruir el estado pasado, cierres por fecha, tiempos reales de resolución ni productividad por usuario. `updated` no sustituye la fecha de confirmación. Tampoco se puede medir cumplimiento de obligaciones o vencimientos sin un padrón y plazos verificados.

## Contrato funcional propuesto, pendiente de acordar

1. Usar `fecha_recepcion` para el periodo solo después de confirmar/corregir su significado. Mantener `periodo_correspondiente` como concepto de negocio distinto del rango de fechas y de `created`.
2. Fechas desde/hasta inclusivas para la persona usuaria; convertir en servidor a un intervalo de inicio incluido y final exclusivo, con zona horaria institucional por confirmar (propuesta: America/Mexico_City).
3. Excluir borrados lógicos. Informar registros sin fecha válida separadamente; no asignarlos artificialmente a un mes. Mostrar estados/tipos vacíos o desconocidos sin descartarlos silenciosamente.
4. Los estados son los actuales al momento de consulta de los expedientes recibidos en el periodo. No presentarlos como estado histórico al cierre del periodo.
5. Calcular porcentajes sobre el total autorizado y filtrado; si el denominador es cero, mostrar «No aplica». Distinguir cero real, sin datos y fallo de consulta.
6. Comparación con el intervalo inmediatamente anterior de igual duración. Si la base anterior es cero, mostrar diferencia absoluta y porcentaje no calculable.

## Contenido de pantalla

| Bloque | Contenido propuesto | Fuente/condición |
| --- | --- | --- |
| Hallazgos importantes | Cambio de volumen frente al periodo anterior, estado predominante y registros con error | Reglas deterministas sobre agregados; sin IA ni afirmaciones causales |
| Indicadores clave | Total de expedientes, nombramientos, declaraciones y porcentaje confirmado | Total de ambas colecciones, subtotales por colección y conteo confirmado/total; pendiente de validar catálogo |
| Actividad del periodo | Documentos recibidos por día, semana o mes, separados por colección, incluyendo intervalos con cero | Fecha de recepción validada; no representa cambios de estado |
| Distribución por tipo y estado | Nombramientos/declaraciones; tipos de declaración; estados actuales | `tipo_declaracion` solo en declaraciones; OCR separado, si se incluye posteriormente |
| Exportaciones | Excel de resumen y detalle autorizado; PDF ejecutivo con gráficos, filtros y metodología | Misma fuente de cálculo y corte de consulta que la pantalla |

## Implementación por etapas

### 1. Asegurar el significado de los datos

Contrastar con metadatos autorizados las colecciones, campos, selects, reglas y borrado lógico; no solicitar secretos ni exportar registros. Resolver emisión/recepción y catálogo de estados. Acordar qué roles pueden exportar y cuáles columnas pueden salir. Entregable: diccionario de métricas y permisos revisable. Esta es la primera etapa recomendada.

### 2. Construir el cálculo en el servidor

Propuesta nueva: módulo `lib/reports/` con filtros validados, consulta mínima de campos y funciones puras de agregación. Proponer explícitamente un contrato de lectura para reportes antes de crear una nueva ruta; no existe una ruta de reportes actualmente. Reutilizar sesión verificada y permisos de lectura de las dos colecciones, sin cuentas administrativas ni privilegios adicionales. El navegador recibe agregados, no registros completos con OCR, documentos o CURP.

No calcular a partir de una tabla paginada. Para volumen moderado, recorrer páginas completas en servidor seleccionando campos mínimos; medir latencia y consumo antes de elegir agregación persistida. Fallos o límites deben producir error explícito, nunca totales parciales presentados como completos. Si el volumen exige índices, vistas o tareas, documentar y solicitar autorización por separado antes de tocar el backend.

### 3. Conectar la interfaz

Reutilizar Card, Button, Badge, Table, DataState y Lucide. Incorporar filtros, cuatro indicadores, hallazgos, actividad y distribución. Soportar carga, error, vacío, éxito y falta de permisos, con tablas equivalentes a gráficos para accesibilidad. Mostrar fecha de consulta, criterio temporal y alcance del estado. Cancelar/ignorar respuestas antiguas al cambiar filtros.

### 4. Exportar Excel y PDF

Elegir bibliotecas tras revisar compatibilidad, mantenimiento, licencia y tamaño. Generar XLSX real, no CSV renombrado. Excel: hojas de resumen, detalle permitido y metodología. PDF: encabezado institucional, periodo, indicadores, gráficos y paginación. Excluir OCR, CURP, adjuntos y observaciones del formato inicial; revisar cualquier ampliación de columnas según permisos. Tratar textos como texto para impedir fórmulas en Excel, validar filtros y aplicar permisos también en la descarga.

Usar un resultado común de consulta para pantalla y archivos. Capturar un corte y reutilizar los agregados; si no se garantiza consistencia durante cambios concurrentes, explicitarlo y probarlo. No prometer una instantánea transaccional entre colecciones. Definir límites de filas/tiempo antes de habilitar descargas grandes. Sin datos disponibles, deshabilitar exportación con explicación.

### 5. Verificar y entregar

Pruebas con datos ficticios: límites de fechas/zona horaria, fechas ausentes, borrado lógico, estados desconocidos, denominador cero, comparación sin base, múltiples páginas y fallo intermedio. Verificar denegación sin sesión y por permisos, equivalencia entre detalle/agregados/exportaciones y ausencia de campos sensibles. Ejecutar TypeScript, lint y compilación. Abrir XLSX y PDF generados y revisar paginación, encabezados y legibilidad; verificar móvil, teclado y estados de interfaz.

## Criterios de aceptación

- Totales cuadran con todas las filas autorizadas y filtradas; ninguna página queda fuera silenciosamente.
- Los mismos filtros y corte explican pantalla, Excel y PDF.
- Cero y dato no disponible tienen representaciones distintas.
- Los hallazgos incluyen base de comparación y se pueden reproducir con conteos.
- Ningún fallo de colección produce una cifra aparentemente completa.
- No se exponen campos fuera del contrato de exportación ni credenciales.

## Trabajo realizado en esta revisión

Solo se añadió este plan y `docs/previews/reportes-propuesta.html`, un esquema visual sin conexión ni valores de producción. No se modificó el código de aplicación. No se ejecutaron lint, TypeScript o build porque no se implementaron cambios ejecutables en Next.js; tampoco se verificó la instancia activa ni se generaron archivos Excel/PDF.
