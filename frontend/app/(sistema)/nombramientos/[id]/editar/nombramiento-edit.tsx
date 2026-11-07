"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DataState } from "@/components/data-state";
import { hasPermission } from "@/lib/auth/authorization";
import { useAppRole } from "@/app/app-shell";
import type { NombramientoDTO } from "@/lib/records/projections";

type ApiError = { error?: unknown };

type EditableFields = {
  numero_nombramiento: string;
  nombre_funcionario: string;
  cargo: string;
  fecha_recepcion: string;
  fecha_nombramiento: string;
  periodo_correspondiente: string;
  estado_proceso: string;
  observaciones: string;
};

function asText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function NombramientoEdit({ id }: { id: string }) {
  const router = useRouter();
  const role = useAppRole() ?? "auditor";
  const [data, setData] = useState<NombramientoDTO | null>(null);
  const [fields, setFields] = useState<EditableFields | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [notice, setNotice] = useState<{ kind: "info" | "success" | "error"; message: string } | null>(null);
  const redirectTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (redirectTimer.current !== null) {
        window.clearTimeout(redirectTimer.current);
        redirectTimer.current = null;
      }
    };
  }, []);

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
      .then((dto) => {
        setData(dto);
        setFields({
          numero_nombramiento: dto.numero_nombramiento ?? "",
          nombre_funcionario: dto.nombre_funcionario ?? "",
          cargo: dto.cargo ?? "",
          fecha_recepcion: dto.fecha_recepcion ?? "",
          fecha_nombramiento: dto.fecha_nombramiento ?? "",
          periodo_correspondiente: dto.periodo_correspondiente ?? "",
          estado_proceso: dto.estado_proceso ?? "",
          observaciones: "observaciones" in dto ? dto.observaciones ?? "" : "",
        });
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === "AbortError") return;
        setFailed(true);
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [id]);

  function scheduleRedirectToDetail(delayMs = 1200) {
    if (redirectTimer.current !== null) {
      window.clearTimeout(redirectTimer.current);
      redirectTimer.current = null;
    }
    redirectTimer.current = window.setTimeout(() => {
      router.push(`/nombramientos/${id}`);
    }, delayMs);
  }

  async function submit() {
    if (!fields || saving) return;
    setSaving(true);
    setNotice({ kind: "info", message: "Guardando cambios…" });

    try {
      const response = await fetch(`/api/nombramientos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(fields),
      });

      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(typeof (payload as ApiError | null)?.error === "string" ? (payload as ApiError).error as string : "No fue posible guardar los cambios.");
      }

      // Refresca el detalle en pantalla para la siguiente vista.
      setNotice({ kind: "success", message: "Cambios guardados correctamente." });
      scheduleRedirectToDetail();
    } catch (cause) {
      setNotice({ kind: "error", message: cause instanceof Error ? cause.message : "No fue posible guardar los cambios." });
    } finally {
      setSaving(false);
    }
  }

  if (!hasPermission(role, "nombramientos", "correct")) {
    return (
      <DataState
        state="error"
        title="Acceso no disponible"
        description="Tu perfil no tiene permiso para editar nombramientos."
      />
    );
  }

  if (loading) return <DataState state="loading" message="Cargando edición…" />;
  if (failed || !data || !fields) {
    return (
      <DataState
        state="error"
        title="No se pudo cargar el nombramiento"
        description="Revisa tu sesión y los permisos de PocketBase para este recurso."
      />
    );
  }

  return (
    <div className="px-5 py-6 sm:px-6">
      {notice && (
        <div className="mb-4">
          <section
            role={notice.kind === "error" ? "alert" : undefined}
            className={`rounded-md px-4 py-3 text-sm ring-1 ${
              notice.kind === "success"
                ? "bg-emerald-50 text-emerald-900 ring-emerald-200"
                : notice.kind === "error"
                  ? "bg-red-50 text-red-900 ring-red-200"
                  : "bg-slate-50 text-slate-800 ring-slate-200"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <p className="min-w-0 flex-1">{notice.message}</p>
              <Button type="button" variant="ghost" onClick={() => setNotice(null)} className="h-7 px-2 text-xs">
                Cerrar
              </Button>
            </div>
          </section>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="numero_nombramiento">Número</label>
          <input
            id="numero_nombramiento"
            value={fields.numero_nombramiento}
            onChange={(e) => setFields((v) => v ? ({ ...v, numero_nombramiento: asText(e.target.value) }) : v)}
            className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-red-700 focus:ring-2 focus:ring-red-700/15"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="nombre_funcionario">Funcionario</label>
          <input
            id="nombre_funcionario"
            value={fields.nombre_funcionario}
            onChange={(e) => setFields((v) => v ? ({ ...v, nombre_funcionario: asText(e.target.value) }) : v)}
            className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-red-700 focus:ring-2 focus:ring-red-700/15"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="cargo">Cargo</label>
          <input
            id="cargo"
            value={fields.cargo}
            onChange={(e) => setFields((v) => v ? ({ ...v, cargo: asText(e.target.value) }) : v)}
            className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-red-700 focus:ring-2 focus:ring-red-700/15"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="periodo_correspondiente">Periodo</label>
          <input
            id="periodo_correspondiente"
            value={fields.periodo_correspondiente}
            onChange={(e) => setFields((v) => v ? ({ ...v, periodo_correspondiente: asText(e.target.value) }) : v)}
            className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-red-700 focus:ring-2 focus:ring-red-700/15"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="fecha_recepcion">Fecha recepción</label>
          <input
            id="fecha_recepcion"
            type="date"
            value={fields.fecha_recepcion}
            onChange={(e) => setFields((v) => v ? ({ ...v, fecha_recepcion: asText(e.target.value) }) : v)}
            className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-red-700 focus:ring-2 focus:ring-red-700/15"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="fecha_nombramiento">Fecha nombramiento</label>
          <input
            id="fecha_nombramiento"
            type="date"
            value={fields.fecha_nombramiento}
            onChange={(e) => setFields((v) => v ? ({ ...v, fecha_nombramiento: asText(e.target.value) }) : v)}
            className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-red-700 focus:ring-2 focus:ring-red-700/15"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="estado_proceso">Estado</label>
          <input
            id="estado_proceso"
            value={fields.estado_proceso}
            onChange={(e) => setFields((v) => v ? ({ ...v, estado_proceso: asText(e.target.value) }) : v)}
            className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-red-700 focus:ring-2 focus:ring-red-700/15"
          />
          <p className="mt-1 text-xs text-slate-500">Debe coincidir con los valores configurados en PocketBase.</p>
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="observaciones">Observaciones</label>
          <textarea
            id="observaciones"
            rows={4}
            value={fields.observaciones}
            onChange={(e) => setFields((v) => v ? ({ ...v, observaciones: asText(e.target.value) }) : v)}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-red-700 focus:ring-2 focus:ring-red-700/15"
          />
        </div>
      </div>

      <div className="mt-6 flex flex-col-reverse justify-between gap-2 border-t border-slate-100 pt-5 sm:flex-row">
        <Link href={`/nombramientos/${id}`} className="text-sm font-medium text-slate-700 underline underline-offset-4 hover:text-slate-900">
          Cancelar
        </Link>
        <Button type="button" disabled={saving} onClick={submit} className="h-10 rounded-md bg-[#a82732] px-4 text-white hover:bg-[#8e202a]">
          {saving ? "Guardando…" : "Guardar cambios"}
        </Button>
      </div>
    </div>
  );
}
