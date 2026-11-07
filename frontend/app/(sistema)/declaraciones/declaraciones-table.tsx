"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DataState } from "@/components/data-state";
import { hasPermission } from "@/lib/auth/authorization";
import { useAppRole } from "@/app/app-shell";
import type { DeclaracionPage } from "@/lib/records/declaraciones";

export function DeclaracionesTable() {
  const role = useAppRole() ?? "auditor";
  const [data, setData] = useState<DeclaracionPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [page, setPage] = useState(1);
  const [reloadToken, setReloadToken] = useState(0);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/declaraciones?page=${page}&perPage=20`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("request_failed");
        return response.json() as Promise<DeclaracionPage>;
      })
      .then(setData)
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === "AbortError") return;
        setFailed(true);
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [page, reloadToken]);

  async function handleSoftDelete(recordId: string) {
    if (deletingId) return;

    const confirmed = window.confirm(
      "¿Deseas eliminar esta declaración? La acción es reversible solo por administración.",
    );
    if (!confirmed) return;

    setDeletingId(recordId);
    try {
      const response = await fetch(`/api/declaraciones/${recordId}`, {
        method: "DELETE",
        cache: "no-store",
      });
      if (!response.ok) throw new Error("delete_failed");
      setLoading(true);
      setFailed(false);
      setReloadToken((value) => value + 1);
    } catch {
      setFailed(true);
    } finally {
      setDeletingId(null);
    }
  }

  let content;
  if (loading) {
    content = (
      <tr>
        <td colSpan={6}>
          <DataState state="loading" message="Cargando declaraciones…" />
        </td>
      </tr>
    );
  } else if (failed) {
    content = (
      <tr>
        <td colSpan={6}>
          <DataState
            state="error"
            title="No se pudieron consultar las declaraciones"
            description="Revisa tu sesión y los permisos de PocketBase para esta colección."
          />
        </td>
      </tr>
    );
  } else if (!data?.items.length) {
    content = (
      <tr>
        <td colSpan={6}>
          <DataState
            state="empty"
            title="No hay declaraciones disponibles"
            description="No se encontraron declaraciones para esta consulta."
          />
        </td>
      </tr>
    );
  } else {
    content = data.items.map((item) => (
      <tr key={item.id} className="border-t border-slate-100">
        <td className="px-5 py-3">{item.nombre_declarante ?? "—"}</td>
        <td className="px-5 py-3">{item.tipo_declaracion ?? "—"}</td>
        <td className="px-5 py-3">{item.fecha ?? "—"}</td>
        <td className="px-5 py-3">{item.fecha_recepcion ?? "—"}</td>
        <td className="px-5 py-3">{item.estado_proceso ?? "—"}</td>
        <td className="px-5 py-3 text-right">
          <span className="inline-flex flex-wrap justify-end gap-2">
            {hasPermission(role, "declaraciones", "read") && (
              <Link
                className="text-xs font-medium text-slate-700 underline underline-offset-2 hover:text-slate-900"
                href={`/declaraciones/${item.id}`}
              >
                Ver detalle
              </Link>
            )}
            {hasPermission(role, "declaraciones", "correct") && (
              <Link
                className="text-xs font-medium text-slate-700 underline underline-offset-2 hover:text-slate-900"
                href={`/declaraciones/${item.id}/editar`}
              >
                Editar
              </Link>
            )}
            {hasPermission(role, "declaraciones", "soft_delete") && (
              <button
                type="button"
                disabled={deletingId === item.id}
                onClick={() => handleSoftDelete(item.id)}
                className="text-xs font-medium text-red-700 underline underline-offset-2 hover:text-red-800 disabled:opacity-60"
              >
                Eliminar
              </button>
            )}
          </span>
        </td>
      </tr>
    ));
  }

  return (
    <>
      <tbody>{content}</tbody>
      {data && data.totalPages > 1 && (
        <tfoot>
          <tr>
            <td colSpan={6} className="border-t border-slate-100 px-5 py-3">
              <nav
                aria-label="Paginación de declaraciones"
                className="flex items-center justify-between"
              >
                <span className="text-xs text-slate-500">
                  Página {data.page} de {data.totalPages}
                </span>
                <span className="flex gap-2">
                  <button
                    type="button"
                    disabled={page <= 1 || loading}
                    onClick={() => {
                      setLoading(true);
                      setFailed(false);
                      setPage((value) => value - 1);
                    }}
                    className="rounded border border-slate-300 px-3 py-1 text-sm disabled:opacity-50"
                  >
                    Anterior
                  </button>
                  <button
                    type="button"
                    disabled={page >= data.totalPages || loading}
                    onClick={() => {
                      setLoading(true);
                      setFailed(false);
                      setPage((value) => value + 1);
                    }}
                    className="rounded border border-slate-300 px-3 py-1 text-sm disabled:opacity-50"
                  >
                    Siguiente
                  </button>
                </span>
              </nav>
            </td>
          </tr>
        </tfoot>
      )}
    </>
  );
}