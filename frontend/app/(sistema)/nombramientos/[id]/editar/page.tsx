import Link from "next/link";
import { NombramientoEdit } from "@/app/(sistema)/nombramientos/[id]/editar/nombramiento-edit";

export default function EditarNombramientoPage({ params }: { params: { id: string } }) {
  return (
    <>
      <header className="border-b border-slate-200 bg-white px-5 py-6 sm:px-8 lg:px-10">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="mb-1 text-xs font-medium text-slate-500">Módulos / Nombramientos / Editar</p>
            <h1 className="text-2xl font-semibold tracking-tight">Editar nombramiento</h1>
            <p className="mt-1 text-sm text-slate-600">ID: {params.id}</p>
          </div>
          <Link href={`/nombramientos/${params.id}`} className="text-sm font-medium text-slate-700 underline underline-offset-4 hover:text-slate-900">
            Volver al detalle
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-[1440px] px-5 py-6 sm:px-8 sm:py-8 lg:px-10">
        <section className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200/80">
          <NombramientoEdit id={params.id} />
        </section>
      </div>
    </>
  );
}
