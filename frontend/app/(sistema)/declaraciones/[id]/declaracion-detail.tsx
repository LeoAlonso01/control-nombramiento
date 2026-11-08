"use client";

import { useEffect, useState } from "react";
import { DataState } from "@/components/data-state";
import type { DeclaracionDTO } from "@/lib/records/projections";

type ApiError = { error?: unknown };

function maskCurp(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= 8) return trimmed;
  return trimmed.slice(0, 4) + "***" + trimmed.slice(-4);
}

export function DeclaracionDetail({ id }: { id: string }) {
  const [data, setData] = useState<DeclaracionDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

 
useEffect(() => {
  const controller = new AbortController();

  setLoading(true);
  setFailed(false);
  setData(null);

  async function cargarDetalle() {
    try {
      const response = await fetch(
        `/api/declaraciones/${encodeURIComponent(id)}`,
        {
          cache: "no-store",
          signal: controller.signal,
        }
      );

      if (!response.ok) {
        let payload: ApiError | null = null;

        try {
          payload = (await response.json()) as ApiError;
        } catch {
          payload = null;
        }

        throw new Error(
          typeof payload?.error === "string"
            ? payload.error
            : `Error HTTP ${response.status}`
        );
      }

      const resultado =
        (await response.json()) as DeclaracionDTO;

      if (!controller.signal.aborted) {
        setData(resultado);
      }
    } catch (error: unknown) {
      if (controller.signal.aborted) return;

      console.error(
        "Error al consultar declaración:",
        error
      );

      setFailed(true);
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }

  void cargarDetalle();

  return () => {
    controller.abort();
  };
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
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Declarante</dt>
          <dd className="mt-1 text-sm text-slate-900">{data.nombre_declarante ?? "—"}</dd>
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
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tipo</dt>
          <dd className="mt-1 text-sm text-slate-900">{data.tipo_declaracion ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Fecha</dt>
          <dd className="mt-1 text-sm text-slate-900">{data.fecha ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Fecha de recepción</dt>
          <dd className="mt-1 text-sm text-slate-900">{data.fecha_recepcion ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Periodo</dt>
          <dd className="mt-1 text-sm text-slate-900">{data.periodo_correspondiente ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Lugar</dt>
          <dd className="mt-1 text-sm text-slate-900">{data.lugar_declaracion ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Estado</dt>
          <dd className="mt-1 text-sm text-slate-900">{data.estado_proceso ?? "—"}</dd>
        </div>

        {"curp_declarante" in data && (
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">CURP (enmascarada)</dt>
            <dd className="mt-1 text-sm text-slate-900">
              {data.curp_declarante ? maskCurp(data.curp_declarante) : "—"}
            </dd>
          </div>
        )}

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