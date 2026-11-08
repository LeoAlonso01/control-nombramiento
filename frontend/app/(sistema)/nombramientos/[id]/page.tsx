import Link from "next/link";
import { Suspense } from "react";
import { NombramientoDetail } from "@/app/(sistema)/nombramientos/[id]/nombramiento-detail";

type PageProps = {
  params: Promise<{ id: string }>;
};

async function ContenidoNombramiento({
  params,
}: PageProps) {
  const { id } = await params;

  return (
    <section className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200/80">
      <NombramientoDetail id={id} />
    </section>
  );
}

export default function NombramientoDetallePage({
  params,
}: PageProps) {
  return (
    <>
      <header className="border-b border-slate-200 bg-white px-5 py-6 sm:px-8 lg:px-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Detalle del nombramiento
          </h1>

          <Link
            href="/nombramientos"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
          >
            <span aria-hidden="true">←</span>
            Volver al listado
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-[1440px] px-5 py-6 sm:px-8 sm:py-8 lg:px-10">
        <Suspense
          fallback={
            <div className="rounded-xl bg-white p-6 text-sm text-slate-500">
              Cargando nombramiento...
            </div>
          }
        >
          <ContenidoNombramiento params={params} />
        </Suspense>
      </div>
    </>
  );
}