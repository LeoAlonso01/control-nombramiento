
"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAppRole } from "@/app/app-shell";
import { hasPermission } from "@/lib/auth/authorization";
import {
  DECLARATION_TYPES,
  DECLARATION_TYPE_LABELS,
} from "@/lib/records/contracts";
import type { DeclaracionDTO } from "@/lib/records/projections";

type Props = { id: string };

type Fields = {
  nombre_declarante: string;
  curp_declarante: string;
  lugar_declaracion: string;
  fecha: string;
  tipo_declaracion: string;
  fecha_recepcion: string;
  periodo_correspondiente: string;
  observaciones: string;
};

const EMPTY: Fields = {
  nombre_declarante: "",
  curp_declarante: "",
  lugar_declaracion: "",
  fecha: "",
  tipo_declaracion: "",
  fecha_recepcion: "",
  periodo_correspondiente: "",
  observaciones: "",
};

const FINAL_STATES = ["confirmado", "rechazado"];

function dateInput(value: string | null | undefined) {
  return value?.slice(0, 10) ?? "";
}

function toFields(data: DeclaracionDTO): Fields {
  return {
    nombre_declarante: data.nombre_declarante ?? "",
    curp_declarante:
      "curp_declarante" in data
        ? data.curp_declarante ?? ""
        : "",
    lugar_declaracion: data.lugar_declaracion ?? "",
    fecha: dateInput(data.fecha),
    tipo_declaracion: data.tipo_declaracion ?? "",
    fecha_recepcion: dateInput(data.fecha_recepcion),
    periodo_correspondiente: data.periodo_correspondiente ?? "",
    observaciones:
      "observaciones" in data
        ? data.observaciones ?? ""
        : "",
  };
}

function apiError(value: unknown, fallback: string) {
  if (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof value.error === "string"
  ) {
    return value.error;
  }
  return fallback;
}

const inputClass =
  "mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-[#a82732] focus:ring-2 focus:ring-[#a82732]/15";

const fieldsConfig = [
  { key: "nombre_declarante", label: "Nombre del declarante", type: "text" },
  { key: "curp_declarante", label: "CURP del declarante", type: "text" },
  { key: "lugar_declaracion", label: "Lugar de la declaración", type: "text" },
  { key: "fecha", label: "Fecha de la declaración", type: "date" },
  { key: "fecha_recepcion", label: "Fecha de recepción", type: "date" },
  { key: "periodo_correspondiente", label: "Periodo correspondiente", type: "text" },
] as const;

export function DeclaracionEdit({ id }: Props) {
  const router = useRouter();
  const role = useAppRole();

  const [fields, setFields] = useState<Fields>(EMPTY);
  const [original, setOriginal] = useState<Fields>(EMPTY);
  const [estado, setEstado] = useState("");
  const [recordRole, setRecordRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const savingLock = useRef(false);

  const canEdit =
    role != null &&
    hasPermission(role, "declaraciones", "correct");

  const isFinal = FINAL_STATES.includes(estado);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError("");
      setSuccess("");

      try {
        const response = await fetch(
          `/api/declaraciones/${encodeURIComponent(id)}`,
          {
            cache: "no-store",
            signal: controller.signal,
          },
        );

        const data: unknown = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(
            apiError(data, "No fue posible cargar la declaración."),
          );
        }

        const record = data as DeclaracionDTO;
        if (!record || typeof record.id !== "string") {
          throw new Error("La respuesta de la API no es válida.");
        }

        if (!controller.signal.aborted) {
          const initial = toFields(record);
          setFields(initial);
          setOriginal(initial);
          setEstado(record.estado_proceso ?? "");
          setRecordRole(record.role);
        }
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Ocurrió un error al cargar el expediente.",
          );
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void load();
    return () => controller.abort();
  }, [id]);

  function updateField(key: keyof Fields, value: string) {
    setFields((current) => ({ ...current, [key]: value }));
    setError("");
    setSuccess("");
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (savingLock.current || !canEdit || isFinal || loading) return;

    if (recordRole === "auditor") {
      setError("No tienes permiso para modificar esta declaración.");
      return;
    }

    const changes: Partial<Fields> = {};

    for (const key of Object.keys(fields) as (keyof Fields)[]) {
      if (fields[key] !== original[key]) {
        changes[key] = fields[key].trim();
      }
    }

    if (Object.keys(changes).length === 0) {
      setError("No hay cambios para guardar.");
      return;
    }

    savingLock.current = true;
    setSaving(true);
    setError("");

    try {
      const response = await fetch(
        `/api/declaraciones/${encodeURIComponent(id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(changes),
          cache: "no-store",
        },
      );

      const result: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          apiError(result, "No fue posible guardar los cambios."),
        );
      }

      setSuccess("Declaración actualizada correctamente.");
      router.refresh();
      router.push(`/declaraciones/${encodeURIComponent(id)}`);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Ocurrió un error al guardar.",
      );
    } finally {
      savingLock.current = false;
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="p-6 text-sm text-slate-500">Cargando declaración...</p>;
  }

  if (!canEdit || recordRole === "auditor") {
    return (
      <div role="alert" className="rounded-xl bg-white p-6 ring-1 ring-slate-200">
        <h2 className="font-semibold">Acceso no disponible</h2>
        <p className="mt-2 text-sm text-slate-600">
          Tu perfil no tiene permiso para editar declaraciones.
        </p>
      </div>
    );
  }

  if (error && !recordRole) {
    return <p role="alert" className="p-6 text-sm text-red-700">{error}</p>;
  }

  return (
    <form onSubmit={save} className="space-y-6 p-5 sm:p-7">
      <div>
        <h2 className="text-lg font-semibold">Datos de la declaración</h2>
        <p className="mt-1 text-sm text-slate-500">
          Modifica únicamente los campos que necesitan corrección.
        </p>
      </div>

      {isFinal && (
        <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Esta declaración se encuentra en estado {estado} y no admite correcciones.
        </div>
      )}

      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {success && (
        <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          {success}
        </div>
      )}

      <fieldset disabled={saving || isFinal} className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          {fieldsConfig.map(({ key, label, type }) => (
            <div key={key}>
              <label htmlFor={key} className="text-sm font-medium text-slate-700">
                {label}
              </label>
              <input
                id={key}
                type={type}
                value={fields[key]}
                onChange={(event) => updateField(key, event.target.value)}
                maxLength={key === "curp_declarante" ? 18 : undefined}
                className={inputClass}
              />
            </div>
          ))}

          <div>
            <label htmlFor="tipo_declaracion" className="text-sm font-medium text-slate-700">
              Tipo de declaración
            </label>
            <select
              id="tipo_declaracion"
              value={fields.tipo_declaracion}
              onChange={(event) => updateField("tipo_declaracion", event.target.value)}
              className={inputClass}
            >
              <option value="">Selecciona un tipo</option>
              {DECLARATION_TYPES.map((type) => (
                <option key={type} value={type}>
                  {DECLARATION_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="observaciones" className="text-sm font-medium text-slate-700">
              Observaciones
            </label>
            <textarea
              id="observaciones"
              rows={4}
              value={fields.observaciones}
              onChange={(event) => updateField("observaciones", event.target.value)}
              className={`${inputClass} h-auto min-h-28 py-3`}
            />
          </div>
        </div>
      </fieldset>

      <div className="flex flex-col-reverse justify-end gap-3 border-t border-slate-100 pt-5 sm:flex-row">
        <Link
          href={`/declaraciones/${id}`}
          className="inline-flex h-10 items-center justify-center rounded-md border border-slate-300 px-5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Cancelar
        </Link>
        <button
          type="submit"
          disabled={saving || isFinal}
          className="h-10 rounded-md bg-[#a82732] px-5 text-sm font-medium text-white hover:bg-[#8e202a] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "Guardando..." : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
}
