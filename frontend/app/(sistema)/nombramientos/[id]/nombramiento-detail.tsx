"use client";

import { useEffect, useState } from "react";
import { DataState } from "@/components/data-state";
import type { NombramientoDTO } from "@/lib/records/projections";

type ApiError = { error?: unknown };

export function NombramientoDetail({ id }: { id: string }) {
  const [data, setData] = useState<NombramientoDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/nombramientos/${id}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          let payload: ApiError | null = null;
          try {
            payload = (await response.json()) as ApiError;
          } catch {
            payload = null;
          }
          throw new Error(typeof payload?.error === "string" ? payload.error : "request_failed");
        }
        return response.json() as Promise<NombramientoDTO>;
      })
      .then(setData)
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === "AbortError") return;
        setFailed(true);
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [id]);

  if (loading) {
    return <DataState state="loading" message="Cargando detalle…" />;
  }

  if (failed || !data) {
    return (
      <DataState
        state="error"
        title="No se pudo consultar el detalle"
        description="Revisa tu sesión y los permisos de PocketBase para este recurso."
      />
    );
  }

  return (
    <div className="px-5 py-6 sm:px-6">
      <dl className="grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Número</dt>
          <dd className="mt-1 text-sm text-slate-900">{data.numero_nombramiento ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">UUID</dt>
          <dd className="mt-1 text-sm text-slate-900">{data.uuid ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">ID</dt>
          <dd className="mt-1 text-sm text-slate-900">{data.id ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Creado</dt>
          <dd className="mt-1 text-sm text-slate-900">{data.created ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Actualizado</dt>
          <dd className="mt-1 text-sm text-slate-900">{data.updated ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Funcionario</dt>
          <dd className="mt-1 text-sm text-slate-900">{data.nombre_funcionario ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Cargo</dt>
          <dd className="mt-1 text-sm text-slate-900">{data.cargo ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Fecha de recepción</dt>
          <dd className="mt-1 text-sm text-slate-900">{data.fecha_recepcion ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Fecha de emisión</dt>
          <dd className="mt-1 text-sm text-slate-900">{data.fecha_nombramiento ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Periodo</dt>
          <dd className="mt-1 text-sm text-slate-900">{data.periodo_correspondiente ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Estado</dt>
          <dd className="mt-1 text-sm text-slate-900">{data.estado_proceso ?? "—"}</dd>
        </div>
        {"observaciones" in data && (
          <div className="sm:col-span-2">
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Observaciones</dt>
            <dd className="mt-1 whitespace-pre-wrap text-sm text-slate-900">
              {data.observaciones ?? "—"}
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
}