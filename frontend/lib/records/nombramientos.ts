import type { AppRole } from "../auth/authorization.ts";
import { projectNombramiento, type NombramientoDTO } from "./projections.ts";

/**
 * Contrato provisional basado en frontend/docs/pocketbase/pb_schema_current.json.
 * Ningún campo de nombramientos se ha contrastado aún con la instancia activa.
 */
export const NOMBRAMIENTO_FIELDS_PENDING_CONFIRMATION = [
  "uuid", "nombre_funcionario", "cargo", "numero_nombramiento",
  "fecha_nombramiento", "periodo_correspondiente", "fecha_recepcion",
  "estado_ocr", "delete_at", "estado_proceso", "observaciones",
] as const;

export const NOMBRAMIENTO_ESTADOS_PROVISIONALES = [
  "pendiente", "confirmado", "error",
] as const;
export type NombramientoEstado = (typeof NOMBRAMIENTO_ESTADOS_PROVISIONALES)[number];

export type NombramientoFilters = {
  estado_proceso?: NombramientoEstado;
  periodo_correspondiente?: string;
};

export type NombramientoPage = {
  items: NombramientoDTO[];
  page: number;
  perPage: number;
  totalItems: number;
  totalPages: number;
};

const DEFAULT_PER_PAGE = 20;
const MAX_PER_PAGE = 100;
const PERIOD_PATTERN = /^[\p{L}\p{N} ._/-]{1,40}$/u;

export class NombramientoQueryError extends Error {
  constructor() {
    super("Los parámetros de consulta no son válidos.");
    this.name = "NombramientoQueryError";
  }
}

export function parseNombramientoQuery(params: URLSearchParams): {
  page: number; perPage: number; filters: NombramientoFilters;
} {
  const allowed = new Set(["page", "perPage", "estado_proceso", "periodo_correspondiente"]);
  for (const key of params.keys()) {
    if (!allowed.has(key) || params.getAll(key).length !== 1) throw new NombramientoQueryError();
  }
  const pageText = params.get("page") ?? "1";
  const perPageText = params.get("perPage") ?? String(DEFAULT_PER_PAGE);
  if (!/^[1-9]\d{0,5}$/.test(pageText) || !/^[1-9]\d{0,2}$/.test(perPageText)) {
    throw new NombramientoQueryError();
  }
  const page = Number(pageText);
  const perPage = Number(perPageText);
  if (perPage > MAX_PER_PAGE) throw new NombramientoQueryError();

  const state = params.get("estado_proceso");
  if (state && !(NOMBRAMIENTO_ESTADOS_PROVISIONALES as readonly string[]).includes(state)) {
    throw new NombramientoQueryError();
  }
  const period = params.get("periodo_correspondiente");
  if (period && !PERIOD_PATTERN.test(period)) throw new NombramientoQueryError();
  return {
    page, perPage,
    filters: {
      ...(state ? { estado_proceso: state as NombramientoEstado } : {}),
      ...(period ? { periodo_correspondiente: period } : {}),
    },
  };
}

type PocketBaseListClient = {
  collection(name: "nombramientos"): {
    getList<T>(page: number, perPage: number, options: { filter: string; sort: string }): Promise<{
      items: T[]; page: number; perPage: number; totalItems: number; totalPages: number;
    }>;
  };
};

function escapeFilter(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

/** La lista siempre excluye borrado lógico y solo selecciona datos de tabla. */
export async function listNombramientos(
  client: PocketBaseListClient,
  query: ReturnType<typeof parseNombramientoQuery>,
  role: AppRole,
): Promise<NombramientoPage> {
  const clauses = ['delete_at = ""'];
  if (query.filters.estado_proceso) {
    clauses.push(`estado_proceso = "${escapeFilter(query.filters.estado_proceso)}"`);
  }
  if (query.filters.periodo_correspondiente) {
    clauses.push(`periodo_correspondiente = "${escapeFilter(query.filters.periodo_correspondiente)}"`);
  }
  const result = await client.collection("nombramientos").getList<Record<string, unknown>>(
    query.page,
    query.perPage,
    { filter: clauses.join(" && "), sort: "-fecha_recepcion,-id" },
  );
  const items = result.items.map((record) => projectNombramiento(role, record));
  return { items, page: result.page, perPage: result.perPage, totalItems: result.totalItems, totalPages: result.totalPages };
}
