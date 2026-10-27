export default function DashboardClient() {
  return (
    <>
      <header className="border-b border-slate-200 bg-white px-5 py-6 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-[1440px]">
          <p className="mb-1 text-xs font-medium text-slate-500">Inicio</p>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Bienvenido al Sistema de Control de Nombramientos
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Este sistema facilita la captura, revisión y consulta de nombramientos y declaraciones institucionales.
          </p>
        </div>
      </header>
      <div className="mx-auto w-full max-w-[1440px] px-5 py-8 sm:px-8 lg:px-10">
        <section aria-label="Propósito del sistema" className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200/80 sm:p-8">
          <p className="max-w-3xl text-sm leading-7 text-slate-600">
            Utiliza la navegación para acceder a los módulos disponibles según tu perfil. La información de expedientes y reportes se mostrará cuando exista una fuente de datos conectada.
          </p>
        </section>
      </div>
    </>
  );
}
