import type { AppRole } from "../auth/authorization.ts";
import { projectDeclaracion, type DeclaracionDTO } from "./projections.ts";

/**
 * Contrato provisional basado en pb_schema.json.
 * NingÃºn campo de declaraciones se ha contrastado aÃºn con la instancia activa.
 */
export const DECLARACION_FIELDS_PENDING_CONFIRMATION = [
  "uuid",
  "nombre_declarante",
  "fecha",
  "tipo_declaracion",
  "fecha_recepcion",
  "periodo_correspondiente",
  "observaciones",
  "datos_ocr",
  "delete_at",
  "curp_declarante",
  "lugar_declaracion",
  "estado_proceso",
] as const;

export const DECLARACION_ESTADOS_PROVISIONALES = [
  "pendiente",
  "confirmado",
  "error",
] as const;
export type DeclaracionEstado =
  (typeof DECLARACION_ESTADOS_PROVISIONALES)[number];

export type DeclaracionFilters = {
  estado_proceso?: DeclaracionEstado;
  tipo_declaracion?: string;
  periodo_correspondiente?: string;
};

export type DeclaracionPage = {
  items: DeclaracionDTO[];
  page: number;
  perPage: number;
  totalItems: number;
  totalPages: number;
};

const DEFAULT_PER_PAGE = 20;
const MAX_PER_PAGE = 100;
const PERIOD_PATTERN = /^[\p{L}\p{N} ._/-]{1,40}$/u;

export class DeclaracionQueryError extends Error {
  constructor() {
    super("Los parÃ¡metros de consulta no son vÃ¡lidos.");
    this.name = "DeclaracionQueryError";
  }
}

export function parseDeclaracionQuery(params: URLSearchParams): {
  page: number;
  perPage: number;
  filters: DeclaracionFilters;
} {
  const allowed = new Set([
    "page",
    "perPage",
    "estado_proceso",
    "tipo_declaracion",
    "periodo_correspondiente",
  ]);

  for (const key of params.keys()) {
    if (!allowed.has(key) || params.getAll(key).length !== 1) {
      throw new DeclaracionQueryError();
    }
  }

  const pageText = params.get("page") ?? "1";
  const perPageText = params.get("perPage") ?? String(DEFAULT_PER_PAGE);

  if (!/^[1-9]\d{0,5}$/.test(pageText) || !/^[1-9]\d{0,2}$/.test(perPageText)) {
    throw new DeclaracionQueryError();
  }

  const page = Number(pageText);
  const perPage = Number(perPageText);
  if (perPage > MAX_PER_PAGE) throw new DeclaracionQueryError();

  const estado = params.get("estado_proceso");
  if (
    estado &&
    !(DECLARACION_ESTADOS_PROVISIONALES as readonly string[]).includes(estado)
  ) {
    throw new DeclaracionQueryError();
  }

  const tipo = params.get("tipo_declaracion");
  if (tipo && (tipo.length < 1 || tipo.length > 40)) {
    throw new DeclaracionQueryError();
  }

  const periodo = params.get("periodo_correspondiente");
  if (periodo && !PERIOD_PATTERN.test(periodo)) {
    throw new DeclaracionQueryError();
  }

  return {
    page,
    perPage,
    filters: {
      ...(estado ? { estado_proceso: estado as DeclaracionEstado } : {}),
      ...(tipo ? { tipo_declaracion: tipo } : {}),
      ...(periodo ? { periodo_correspondiente: periodo } : {}),
    },
  };
}

type PocketBaseListClient = {
  collection(name: "declaraciones"): {
    getList<T>(
      page: number,
      perPage: number,
      options: { filter: string; sort: string },
    ): Promise<{
      items: T[];
      page: number;
      perPage: number;
      totalItems: number;
      totalPages: number;
    }>;
  };
};

function escapeFilter(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

/** La lista siempre excluye borrado lÃ³gico y solo selecciona datos de tabla. */
export async function listDeclaraciones(
  client: PocketBaseListClient,
  query: ReturnType<typeof parseDeclaracionQuery>,
  role: AppRole,
): Promise<DeclaracionPage> {
  const clauses = ['(delete_at = "" || delete_at = null)'];

  if (query.filters.estado_proceso) {
    clauses.push(
      `estado_proceso = "${escapeFilter(query.filters.estado_proceso)}"`,
    );
  }

  if (query.filters.tipo_declaracion) {
    clauses.push(
      `tipo_declaracion = "${escapeFilter(query.filters.tipo_declaracion)}"`,
    );
  }

  if (query.filters.periodo_correspondiente) {
    clauses.push(
      `periodo_correspondiente = "${escapeFilter(query.filters.periodo_correspondiente)}"`,
    );
  }

  const result = await client
    .collection("declaraciones")
    .getList<Record<string, unknown>>(
      query.page,
      query.perPage,
      { filter: clauses.join(" && "), sort: "-fecha_recepcion,-id" },
    );

  const items = result.items.map((record) => projectDeclaracion(role, record));
  return {
    items,
    page: result.page,
    perPage: result.perPage,
    totalItems: result.totalItems,
    totalPages: result.totalPages,
  };
}

