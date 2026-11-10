import test from "node:test";
import assert from "node:assert/strict";
import { buildReport, canReadReports, loadReportRows, parseReportFilters, previousPeriod, receiptDay, ReportLimitError, ReportQueryError } from "../../lib/reports/report.ts";
import { createReportExcel, createReportPdf } from "../../lib/reports/export.ts";

const filters = { desde: "2026-11-01", hasta: "2026-11-03" };
const row = (id, date, collection = "nombramientos", estado = "pendiente", tipo = "Nombramiento") => ({ id, fecha_recepcion: date, collection, estado, tipo });

test("valida fechas reales, duplicados, rango y parámetros desconocidos", () => {
  assert.deepEqual(parseReportFilters(new URLSearchParams(filters)), filters);
  for (const value of ["", "desde=2026-02-30&hasta=2026-03-01", "desde=2026-11-03&hasta=2026-11-01", "desde=2025-01-01&hasta=2026-12-31", "desde=2026-11-01&hasta=2026-11-03&desde=2026-11-01", "desde=2026-11-01&hasta=2026-11-03&admin=true"]) {
    assert.throws(() => parseReportFilters(new URLSearchParams(value)), ReportQueryError);
  }
  assert.deepEqual(previousPeriod(filters), { desde: "2026-10-29", hasta: "2026-10-31" });
});

test("recepción conserva el día de calendario, acepta formato PB y rechaza fechas inválidas", () => {
  assert.equal(receiptDay("2026-11-01 00:00:00.000Z"), "2026-11-01");
  assert.equal(receiptDay("2026-11-01T00:00:00Z"), "2026-11-01");
  assert.equal(receiptDay("2024-02-29"), "2024-02-29");
  for (const value of [null, "", "2026-02-29", "2026-11-01garbage", "2026-11-01 25:99:99Z"]) assert.equal(receiptDay(value), null);
});

test("totales con extremos inclusivos, comparación y estados conservados", () => {
  const report = buildReport([
    row("n1", "2026-11-01", "nombramientos", "confirmado"),
    row("d1", "2026-11-03", "declaraciones", "error", "Inicio"),
    row("n2", "2026-11-03", "nombramientos", "revision_manual"),
    row("old", "2026-10-31"), row("outside", "2026-11-04"), row("missing", null),
  ], filters, "2026-11-09T12:00:00Z");
  assert.equal(report.total, 3); assert.equal(report.nombramientos, 2); assert.equal(report.declaraciones, 1);
  assert.equal(report.previous.total, 1); assert.equal(report.previous.difference, 2); assert.equal(report.previous.percent, 200);
  assert.equal(report.missingDates, 1); assert.equal(report.confirmedPercent, 100 / 3);
  assert.equal(report.states.find(item => item.label === "revision_manual").count, 1);
  assert.deepEqual(report.types, [{ label: "Inicio", count: 1 }]);
  assert.deepEqual(report.activity[1], { period: "2026-11-02", nombramientos: 0, declaraciones: 0 });
  assert.equal(report.activity.reduce((sum, item) => sum + item.nombramientos + item.declaraciones, 0), report.total);
});

test("base cero, fuente vacía y agrupación mensual no inventan porcentajes", () => {
  const report = buildReport([], filters, "2026-11-09T12:00:00Z");
  assert.equal(report.confirmedPercent, null); assert.equal(report.previous.percent, null);
  assert.equal(report.total, 0); assert.equal(report.activity.length, 3);
  const monthly = buildReport([row("n1", "2026-03-31")], { desde: "2026-01-01", hasta: "2026-03-31" }, report.queriedAt);
  assert.equal(monthly.grouping, "mes"); assert.equal(monthly.activity.length, 3);
  assert.equal(monthly.activity[2].nombramientos, 1);
});

test("consulta todas las páginas con campos mínimos, excluye borrado lógico y no filtra estados", async () => {
  const calls = [];
  const client = { collection(name) { return { async getList(page, perPage, options) {
    calls.push({ name, page, perPage, options });
    const record = { id: `${name}-${page}`, fecha_recepcion: "2026-11-01 00:00:00.000Z", estado_proceso: "estado_existente", tipo_declaracion: "inicio", nombre_funcionario: "FICTICIO", curp_declarante: "FICTICIA", datos_ocr: { secret: true }, documento: "test.pdf" };
    return { items: [record], totalPages: 2, totalItems: 2 };
  } }; } };
  const rows = await loadReportRows(client);
  assert.equal(rows.length, 4); assert.equal(calls.length, 4);
  assert.deepEqual(calls.map(call => call.page), [1, 2, 1, 2]);
  for (const call of calls) {
    assert.match(call.options.filter, /delete_at/);
    assert.doesNotMatch(call.options.fields, /nombre|curp|ocr|documento|observaciones/);
    assert.doesNotMatch(call.options.filter, /estado_proceso/);
  }
  assert.equal(rows[0].estado, "estado_existente"); assert.equal(rows[2].tipo, "Inicio");
  assert.deepEqual(Object.keys(rows[0]).sort(), ["id", "collection", "fecha_recepcion", "estado", "tipo"].sort());
});

test("un fallo intermedio, un cambio de total o un límite impiden devolver datos parciales", async () => {
  const client = (mode) => ({ collection() { return { async getList(page) {
    if (page === 2 && mode === "failure") throw new Error("network");
    return { items: [{ id: `test-${page}` }], totalPages: 2, totalItems: mode === "limit" ? 10001 : mode === "change" && page === 2 ? 3 : 2 };
  } }; } });
  await assert.rejects(loadReportRows(client("failure")), /network/);
  await assert.rejects(loadReportRows(client("change")), /changed/);
  await assert.rejects(loadReportRows(client("limit")), ReportLimitError);
  await assert.rejects(loadReportRows({ collection() { return { async getList() { return { items: [], totalPages: 1, totalItems: 2 }; } }; } }), /incomplete/);
});

test("solo roles con lectura de ambas colecciones acceden al contrato técnico exportable", () => {
  assert.equal(canReadReports(null), false);
  for (const role of ["admin", "capturista", "auditor"]) assert.equal(canReadReports(role), true);
});

test("Excel real conserva totales y textos sin fórmulas; PDF tiene páginas y encabezado", async () => {
  const report = buildReport([row("ficticio", "2026-11-01", "declaraciones", "=1+1", "Inicio")], filters, "2026-11-09T12:00:00Z");
  const { default: ExcelJS } = await import("exceljs");
  const bytes = await createReportExcel(report);
  assert.equal(new TextDecoder().decode(bytes.slice(0, 2)), "PK");
  const book = new ExcelJS.Workbook(); await book.xlsx.load(bytes);
  assert.equal(book.getWorksheet("Resumen").getCell("B5").value, report.total);
  assert.equal(book.getWorksheet("Detalle técnico").rowCount, report.total + 1);
  assert.equal(book.getWorksheet("Detalle técnico").getCell("D2").value, "=1+1");
  assert.equal(book.getWorksheet("Detalle técnico").getCell("D2").type, ExcelJS.ValueType.String);
  assert.equal(book.getWorksheet("Actividad").getCell("D2").value, 1);
  const pdf = await createReportPdf(report);
  const text = new TextDecoder("latin1").decode(pdf);
  assert.equal(text.slice(0, 5), "%PDF-");
  assert.match(text, /Control de Nombramientos/); assert.match(text, /\/Type \/Page/);
});
