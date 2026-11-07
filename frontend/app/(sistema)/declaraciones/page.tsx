import { CreateLink } from "@/app/create-link";
import { DeclaracionesTable } from "@/app/(sistema)/declaraciones/declaraciones-table";

export default function DeclaracionesPage() {
  return (
    <>
      <header className="border-b border-slate-200 bg-white px-5 py-6 sm:px-8 lg:px-10">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="mb-1 text-xs font-medium text-slate-500">Módulos / Declaraciones</p><h1 className="text-2xl font-semibold tracking-tight">Declaraciones</h1><p className="mt-1 text-sm text-slate-600">Consulta y captura las declaraciones patrimoniales recibidas.</p></div>
          <CreateLink resource="declaraciones" href="/captura-declaracion">Registrar declaración</CreateLink>
        </div>
      </header>
      <div className="mx-auto max-w-[1440px] px-5 py-6 sm:px-8 sm:py-8 lg:px-10">
        <section aria-labelledby="declarations-title" className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200/80">
          <div className="border-b border-slate-100 px-5 py-5 sm:px-6"><h2 id="declarations-title" className="text-base font-semibold">Expedientes</h2><p className="mt-1 text-sm text-slate-500">No se muestra CURP en este listado.</p></div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500"><tr><th scope="col" className="px-5 py-3">Declarante</th><th scope="col" className="px-5 py-3">Tipo</th><th scope="col" className="px-5 py-3">Fecha</th><th scope="col" className="px-5 py-3">Recepción</th><th scope="col" className="px-5 py-3">Estado</th><th scope="col" className="px-5 py-3 text-right">Acciones</th></tr></thead>
              <DeclaracionesTable />
            </table>
          </div>
        </section>
      </div>
    </>
  );
}
