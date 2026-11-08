
import Link from "next/link";
import { DeclaracionEdit } from "./declaracion-edit"
import { Suspense } from "react";
import { DataState } from "@/components/data-state";

type PageProps = {
  params: Promise<{ id: string }>;
};

async function ContenidoEditarDeclaracion({
  params,
}: PageProps) {
  const { id } = await params;

  return (
    <>
      <header className="border-b border-slate-200 bg-white px-5 py-6 sm:px-8 lg:px-10">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="mb-1 text-xs font-medium text-slate-500">
              Módulos / Declaraciones / Editar
            </p>

            <h1 className="text-2xl font-semibold tracking-tight">
              Editar declaración
            </h1>

            <p className="mt-1 text-sm text-slate-600">
              ID: {id}
            </p>
          </div>

          <Link
            href={`/declaraciones/${id}`}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
          >
            <span aria-hidden="true">←</span>
            Volver al detalle
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-[1440px] px-5 py-6 sm:px-8 sm:py-8 lg:px-10">
        <section className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200/80">
          <DeclaracionEdit id={id} />
        </section>
      </div>
    </>
  );
}

export default function EditarDeclaracionPage({
  params,
}: PageProps) {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-[1440px] px-5 py-6 text-sm text-slate-500">
          Cargando formulario de edición...
        </div>
      }
    >
      <ContenidoEditarDeclaracion params={params} />
    </Suspense>
  );
}
