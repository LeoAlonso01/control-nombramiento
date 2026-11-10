import { isValidIsoDate, DECLARATION_TYPE_LABELS, isDeclarationType } from "../records/contracts.ts";
import { hasPermission, type AppRole } from "../auth/authorization.ts";

export type ReportFilters = { desde: string; hasta: string };
export type ReportRow = {
  id: string;
  collection: "nombramientos" | "declaraciones";
  fecha_recepcion: string | null;
  estado: string;
  tipo: string;
};
export type Count = { label: string; count: number };
export type Activity = { period: string; nombramientos: number; declaraciones: number };
export type Report = {
  filters: ReportFilters;
  queriedAt: string;
  total: number;
  nombramientos: number;
  declaraciones: number;
  confirmedPercent: number | null;
  previous: { desde: string; hasta: string; total: number; difference: number; percent: number | null };
  missingDates: number;
  states: Count[];
  types: Count[];
  activity: Activity[];
  grouping: "día" | "mes";
  insights: string[];
  rows: ReportRow[];
};

const DAY = 86_400_000;
export const MAX_REPORT_RECORDS = 10_000;
export class ReportQueryError extends Error {}
export class ReportLimitError extends Error {}

/** Los reportes y sus exportaciones solo contienen campos técnicos de recursos legibles. */
export function canReadReports(role: AppRole | null): boolean {
  return !!role && hasPermission(role, "nombramientos", "read") && hasPermission(role, "declaraciones", "read");
}

export function parseReportFilters(params: URLSearchParams): ReportFilters {
  for (const key of params.keys()) {
    if (!["desde", "hasta"].includes(key) || params.getAll(key).length !== 1) throw new ReportQueryError();
  }
  const desde = params.get("desde");
  const hasta = params.get("hasta");
  if (!isValidIsoDate(desde) || !isValidIsoDate(hasta) || desde > hasta ||
    (Date.parse(hasta) - Date.parse(desde)) / DAY > 365 || desde < "1900-01-01" || hasta > "9998-12-31") {
    throw new ReportQueryError();
  }
  return { desde, hasta };
}

function isoDay(ms: number): string { return new Date(ms).toISOString().slice(0, 10); }

export function previousPeriod(filters: ReportFilters) {
  const duration = Date.parse(filters.hasta) - Date.parse(filters.desde) + DAY;
  return { desde: isoDay(Date.parse(filters.desde) - duration), hasta: isoDay(Date.parse(filters.desde) - DAY) };
}

/** fecha_recepcion se maneja como fecha de calendario; no desplazar medianoche por zona horaria. */
export function receiptDay(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (!/^\d{4}-\d{2}-\d{2}(?:$|[ T](?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?Z?$)/.test(value)) return null;
  const day = value.slice(0, 10);
  return isValidIsoDate(day) ? day : null;
}

function countBy(rows: ReportRow[], field: "estado" | "tipo"): Count[] {
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row[field], (counts.get(row[field]) ?? 0) + 1);
  return [...counts].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export function buildReport(source: ReportRow[], filters: ReportFilters, queriedAt: string): Report {
  const previous = previousPeriod(filters);
  const within = (row: ReportRow, period: ReportFilters) => !!row.fecha_recepcion && row.fecha_recepcion >= period.desde && row.fecha_recepcion <= period.hasta;
  const rows = source.filter(row => within(row, filters));
  const prior = source.filter(row => within(row, previous)).length;
  const total = rows.length;
  const difference = total - prior;
  const states = countBy(rows, "estado");
  const grouping = (Date.parse(filters.hasta) - Date.parse(filters.desde)) / DAY > 62 ? "mes" : "día";
  const periods = new Map<string, Activity>();
  for (let day = Date.parse(filters.desde); day <= Date.parse(filters.hasta); day += DAY) {
    const key = isoDay(day).slice(0, grouping === "mes" ? 7 : 10);
    if (!periods.has(key)) periods.set(key, { period: key, nombramientos: 0, declaraciones: 0 });
  }
  for (const row of rows) {
    const key = row.fecha_recepcion!.slice(0, grouping === "mes" ? 7 : 10);
    periods.get(key)![row.collection]++;
  }
  const errors = rows.filter(row => row.estado === "error").length;
  const missingDates = source.filter(row => !row.fecha_recepcion).length;
  const insights = [
    `${total} expedientes recibidos; ${difference >= 0 ? "+" : ""}${difference} frente a ${prior} del periodo anterior (${previous.desde} a ${previous.hasta}).${prior === 0 ? " Variación porcentual no calculable: base anterior cero." : ""}`,
    states.length ? `Estado actual predominante: ${states[0].label} (${states[0].count} de ${total}).` : "No hay expedientes recibidos en este periodo.",
    `${errors} expedientes del periodo tienen el estado actual error.`,
  ];
  return {
    filters, queriedAt, total,
    nombramientos: rows.filter(row => row.collection === "nombramientos").length,
    declaraciones: rows.filter(row => row.collection === "declaraciones").length,
    confirmedPercent: total ? rows.filter(row => row.estado === "confirmado").length * 100 / total : null,
    previous: { ...previous, total: prior, difference, percent: prior ? difference * 100 / prior : null },
    missingDates, states, types: countBy(rows.filter(row => row.collection === "declaraciones"), "tipo"),
    activity: [...periods.values()], grouping, insights, rows,
  };
}

type ReportClient = {
  collection(name: string): {
    getList<T>(page: number, perPage: number, options: { filter: string; sort: string; fields: string; requestKey: null }): Promise<{
      items: T[]; totalPages: number; totalItems: number;
    }>;
  };
};

/** Recorrido completo con límite explícito: nunca devuelve un reporte truncado. */
export async function loadReportRows(client: ReportClient): Promise<ReportRow[]> {
  const rows: ReportRow[] = [];
  for (const collection of ["nombramientos", "declaraciones"] as const) {
    let totalPages = 1;
    let expectedTotal: number | undefined;
    const ids = new Set<string>();
    for (let page = 1; page <= totalPages; page++) {
      const result = await client.collection(collection).getList<Record<string, unknown>>(page, 100, {
        filter: '(delete_at = "" || delete_at = null)', sort: "id",
        fields: `id,fecha_recepcion,estado_proceso${collection === "declaraciones" ? ",tipo_declaracion" : ""}`,
        requestKey: null,
      });
      if (result.totalItems > MAX_REPORT_RECORDS || rows.length + result.items.length > MAX_REPORT_RECORDS) throw new ReportLimitError();
      if (expectedTotal !== undefined && expectedTotal !== result.totalItems) throw new Error("report_changed_during_query");
      expectedTotal = result.totalItems;
      totalPages = result.totalPages;
      for (const record of result.items) {
        if (typeof record.id !== "string" || ids.has(record.id)) throw new Error("report_inconsistent_page");
        ids.add(record.id);
        const state = typeof record.estado_proceso === "string" && record.estado_proceso.trim() ? record.estado_proceso : "Sin estado";
        const type = isDeclarationType(record.tipo_declaracion) ? DECLARATION_TYPE_LABELS[record.tipo_declaracion]
          : typeof record.tipo_declaracion === "string" && record.tipo_declaracion.trim() ? record.tipo_declaracion : "Sin tipo";
        rows.push({ id: record.id, collection, fecha_recepcion: receiptDay(record.fecha_recepcion), estado: state, tipo: collection === "nombramientos" ? "Nombramiento" : type });
      }
    }
    if (ids.size !== expectedTotal) throw new Error("report_incomplete");
  }
  return rows;
}
