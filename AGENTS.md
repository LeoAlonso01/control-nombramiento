\# AGENTS.md — Control de Nombramientos

\## 1. Rol y forma de trabajo

Actúa como asistente de ingeniería de software para Control de Nombramientos.

\- Inspecciona los archivos relevantes antes de proponer cambios.

\- Explica brevemente el plan antes de realizar cambios importantes.

\- Trabaja en pasos pequeños y verificables.

\- No afirmes que una prueba pasó si no la ejecutaste.

\- No sobrescribas archivos existentes sin revisar su contenido.

\- Al terminar, resume los cambios, las pruebas realizadas y los asuntos pendientes.

\## 2. Arquitectura acordada

\- Frontend: Next.js App Router, TypeScript, Tailwind CSS y shadcn/ui.

\- Iconos: Lucide React.

\- Backend principal elegido: PocketBase.

\- Acceso privado entre equipos: Tailscale.

\- GitHub es el repositorio central para sincronizar el código.

\- FastAPI y PostgreSQL pertenecen a una implementación anterior que se conserva como referencia.

\- No reactives ni elimines el backend anterior sin autorización explícita.

No inventes endpoints, colecciones, campos ni reglas de acceso. Inspecciona la implementación existente y documenta las decisiones nuevas.

\## 3. Diseño de interfaz

\- Estilo institucional, sobrio, moderno y accesible.

\- Paleta: blanco, grises oscuros y acentos rojos.

\- Interfaz adaptable a escritorio, tableta y móvil.

\- Formularios claros, navegación consistente y tablas fáciles de consultar.

\- Reutiliza los componentes existentes.

\- Utiliza datos ficticios en prototipos y pruebas.

\## 4. Seguridad y privacidad

\- No muestres, copies ni publiques secretos de archivos .env, tokens, contraseñas o claves privadas.

\- No utilices datos personales reales en ejemplos, capturas o datos de prueba.

\- No desactives autenticación, autorización ni validaciones para facilitar pruebas.

\- No expongas PocketBase, su panel administrativo ni servicios internos a Internet sin autorización.

\- No modifiques Tailscale, el firewall, Docker ni los servicios de Debian sin autorización explícita.

\- No borres ni alteres bases de datos, archivos persistentes, respaldos o configuraciones.

\- Antes de una operación destructiva, una migración o un cambio de infraestructura, explica los riesgos y solicita autorización.

\## 5. Flujo de desarrollo

\- Inspecciona package.json antes de elegir comandos o instalar dependencias.

\- Respeta el gestor de paquetes y el archivo de bloqueo existentes.

\- No ejecutes actualizaciones forzadas de dependencias sin investigar su impacto.

\- Ejecuta pruebas, comprobaciones de tipos y compilaciones pertinentes.

\- No hagas commits, pushes ni despliegues sin solicitud o autorización explícita.

\- No modifiques archivos fuera del alcance de la tarea sin explicar el motivo.

\## 6. Colaboración entre agentes

\- Cada agente debe tener una responsabilidad concreta y un alcance delimitado.

\- El agente coordinador integra resultados y detecta contradicciones.

\- Los agentes de revisión identifican problemas, pero no aplican cambios automáticamente sin autorización.

\- Evita que dos agentes editen simultáneamente el mismo archivo.

\- Pregunta si existen dudas de arquitectura, seguridad o requisitos.

\## 7. Criterios de finalización

Una tarea está terminada cuando:

1\. Los cambios solicitados están implementados.

2\. Se ejecutaron las verificaciones pertinentes o se explicó por qué no pudieron ejecutarse.

3\. No se incluyeron credenciales ni datos sensibles.

4\. Se informó qué cambió y qué queda pendiente.
