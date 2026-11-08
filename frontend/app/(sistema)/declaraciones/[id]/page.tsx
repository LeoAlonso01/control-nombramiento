
import Link from "next/link";
import { Suspense } from "react";
import { DeclaracionDetail } from "@/app/(sistema)/declaraciones/[id]/declaracion-detail";

type PageProps = {
  params: Promise<{ id: string }>;
};

async function ContenidoDeclaracion({
  params,
}: PageProps) {
  const { id } = await params;

  return (
    <>
      <header className="border-b border-slate-200 bg-white px-5 py-6 sm:px-8 lg:px-10">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="mb-1 text-xs font-medium text-slate-500">
              Módulos / Declaraciones / Detalle
            </p>

            <h1 className="text-2xl font-semibold tracking-tight">
              Detalle de declaración
            </h1>

            <p className="mt-1 text-sm text-slate-600">
              Consulta la información proyectada del expediente.
            </p>
          </div>

          <Link
            href="/declaraciones"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
          >
            <span aria-hidden="true">←</span>
            Volver al listado
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-[1440px] px-5 py-6 sm:px-8 sm:py-8 lg:px-10">
        <section className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200/80">
          <DeclaracionDetail id={id} />
        </section>
      </div>
    </>
  );
}

export default function DeclaracionDetallePage({
  params,
}: PageProps) {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-[1440px] px-5 py-6 text-sm text-slate-500">
          Cargando declaración...
        </div>
      }
    >
      <ContenidoDeclaracion params={params} />
    </Suspense>
  );
}
