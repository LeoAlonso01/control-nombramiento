"use client";

import { useEffect, useState } from "react";
import { DataState } from "@/components/data-state";
import type { NombramientoPage } from "@/lib/records/nombramientos";

export function NombramientosTable() {
  const [data, setData] = useState<NombramientoPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/nombramientos?page=${page}&perPage=20`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("request_failed");
        return response.json() as Promise<NombramientoPage>;
      })
      .then(setData)
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === "AbortError") return;
        setFailed(true);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [page]);

  let content;
  if (loading) {
    content = <tr><td colSpan={6}><DataState state="loading" message="Cargando nombramientos…" /></td></tr>;
  } else if (failed) {
    content = <tr><td colSpan={6}><DataState state="error" title="No se pudieron consultar los nombramientos" description="La lectura permanece pendiente de habilitarse para los roles de la aplicación." /></td></tr>;
  } else if (!data?.items.length) {
    content = <tr><td colSpan={6}><DataState state="empty" title="No hay expedientes disponibles" description="No se encontraron nombramientos para esta consulta." /></td></tr>;
  } else {
    content = data.items.map((item) => <tr key={item.id} className="border-t border-slate-100">
      <td className="px-5 py-3">{item.numero_nombramiento ?? "—"}</td>
      <td className="px-5 py-3">{item.nombre_funcionario ?? "—"}</td>
      <td className="px-5 py-3">{item.cargo ?? "—"}</td>
      <td className="px-5 py-3">{item.fecha_recepcion ?? "—"}</td>
      <td className="px-5 py-3">{item.fecha_nombramiento ?? "—"}</td>
      <td className="px-5 py-3">{item.estado_proceso ?? "—"}</td>
    </tr>);
  }

  return <>
    <tbody>{content}</tbody>
    {data && data.totalPages > 1 && <tfoot><tr><td colSpan={6} className="border-t border-slate-100 px-5 py-3">
      <nav aria-label="Paginación de nombramientos" className="flex items-center justify-between">
        <span className="text-xs text-slate-500">Página {data.page} de {data.totalPages}</span>
        <span className="flex gap-2">
          <button type="button" disabled={page <= 1 || loading} onClick={() => { setLoading(true); setFailed(false); setPage((value) => value - 1); }} className="rounded border border-slate-300 px-3 py-1 text-sm disabled:opacity-50">Anterior</button>
          <button type="button" disabled={page >= data.totalPages || loading} onClick={() => { setLoading(true); setFailed(false); setPage((value) => value + 1); }} className="rounded border border-slate-300 px-3 py-1 text-sm disabled:opacity-50">Siguiente</button>
        </span>
      </nav>
    </td></tr></tfoot>}
  </>;
}
