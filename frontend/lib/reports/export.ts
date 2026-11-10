import type { Report } from "./report.ts";

export const REPORT_METHOD = "Fecha de recepción de calendario, extremos incluidos. Estados actuales al consultar; se excluyen borrados lógicos. Conteos de expedientes, no de personas. Consulta secuencial sin instantánea transaccional entre colecciones.";
export function percent(value: number | null): string {
  return value === null ? "No aplica" : `${value.toLocaleString("es-MX", { maximumFractionDigits: 1 })}%`;
}
export function reportPeriod(report: Report): string { return `${report.filters.desde} a ${report.filters.hasta}`; }

/** Exporta exclusivamente la misma respuesta autorizada que alimenta la pantalla. */
export async function createReportExcel(report: Report): Promise<Uint8Array> {
  const { default: ExcelJS } = await import("exceljs");
  const book = new ExcelJS.Workbook();
  book.creator = "Control de Nombramientos";
  book.created = new Date(report.queriedAt);
  const summary = book.addWorksheet("Resumen");
  summary.addRows([
    ["Control de Nombramientos", "Reporte institucional"],
    ["Periodo de recepción", reportPeriod(report)], ["Consulta iniciada (UTC)", report.queriedAt],
    ["Indicador", "Valor"], ["Total de expedientes", report.total],
    ["Nombramientos", report.nombramientos], ["Declaraciones", report.declaraciones],
    ["Porcentaje confirmado", percent(report.confirmedPercent)],
    ["Total del periodo anterior", report.previous.total],
    ["Periodo anterior", `${report.previous.desde} a ${report.previous.hasta}`],
    ["Variación absoluta", report.previous.difference], ["Variación porcentual", percent(report.previous.percent)],
    ["Registros sin recepción válida (fuente completa)", report.missingDates],
    [], ["Hallazgos"], ...report.insights.map(text => [text]),
    [], ["Estado actual", "Cantidad"], ...report.states.map(row => [row.label, row.count]),
    [], ["Tipo de declaración", "Cantidad"], ...report.types.map(row => [row.label, row.count]),
  ]);
  const activity = book.addWorksheet("Actividad");
  activity.addRow(["Periodo", "Nombramientos", "Declaraciones", "Total"]);
  report.activity.forEach(row => activity.addRow([row.period, row.nombramientos, row.declaraciones, row.nombramientos + row.declaraciones]));
  const detail = book.addWorksheet("Detalle técnico");
  detail.addRow(["ID", "Colección", "Fecha de recepción", "Estado actual", "Tipo"]);
  // Strings explícitas: los prefijos =, +, - y @ no se convierten en fórmulas.
  report.rows.forEach(row => detail.addRow([row.id, row.collection, row.fecha_recepcion ?? "", row.estado, row.tipo]));
  const method = book.addWorksheet("Metodología");
  method.addRows([["Criterio", "Descripción"], ["Metodología", REPORT_METHOD],
    ["Fechas faltantes", `${report.missingDates} registros autorizados sin fecha válida, excluidos de los periodos.`],
    ["Privacidad", "Detalle técnico sin nombres, CURP, observaciones, OCR ni archivos."],
    ["Comparación", "Periodo inmediatamente anterior de igual duración; base cero sin variación porcentual."],
    ["Corte", report.queriedAt], ["Integridad", "Pantalla y archivos usan la misma respuesta. Cambios concurrentes no constituyen una instantánea histórica."]]);
  for (const sheet of book.worksheets) {
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    sheet.columns.forEach((column, index) => { column.width = index === 0 ? 48 : 35; });
    sheet.eachRow(row => {
      row.alignment = { vertical: "top", wrapText: true };
      let lines = 1;
      row.eachCell((cell, index) => {
        lines = Math.max(lines, Math.ceil(String(cell.value ?? "").length / Math.max(10, Number(sheet.getColumn(index).width) - 4)));
      });
      row.height = Math.min(409, Math.max(30, lines * 16 + 10));
    });
    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFA82732" } };
    sheet.pageSetup = { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
  }
  return new Uint8Array(await book.xlsx.writeBuffer());
}

export async function createReportPdf(report: Report): Promise<Uint8Array> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = 40;
  function header() {
    doc.setFillColor(168, 39, 50); doc.rect(0, 0, 210, 3, "F");
    doc.setTextColor(30, 41, 59); doc.setFont("helvetica", "bold"); doc.setFontSize(15);
    doc.text("Control de Nombramientos", 16, 15);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9);
    doc.text(`Reporte de recepción: ${reportPeriod(report)}`, 16, 22);
    doc.text(`Consulta iniciada (UTC): ${report.queriedAt}`, 16, 28);
  }
  function room(height: number) {
    if (y + height > 278) { doc.addPage(); header(); y = 40; }
  }
  function text(value: string, bold = false) {
    const clean = value.replace(/[\u0000-\u001f\u007f]/g, " ").replaceAll("—", "-");
    doc.setFont("helvetica", bold ? "bold" : "normal"); doc.setFontSize(bold ? 11 : 10);
    const lines: string[] = doc.splitTextToSize(clean, 176);
    for (const line of lines) { room(6); doc.text(line, 16, y); y += 5; }
    y += 3;
  }
  function heading(label: string) { room(20); y += 4; text(label, true); }
  function bar(label: string, count: number, max: number, secondary = false) {
    room(24); text(`${label}: ${count}`);
    doc.setFillColor(235, 238, 242); doc.rect(16, y - 1, 176, 3, "F");
    if (secondary) doc.setFillColor(71, 85, 105); else doc.setFillColor(168, 39, 50);
    if (count > 0) doc.rect(16, y - 1, 176 * count / Math.max(1, max), 3, "F");
    y += 6;
  }
  header();
  heading("Indicadores clave");
  text(`Total: ${report.total} | Nombramientos: ${report.nombramientos} | Declaraciones: ${report.declaraciones}`);
  text(`Porcentaje confirmado: ${percent(report.confirmedPercent)}`);
  heading("Hallazgos importantes"); report.insights.forEach(value => text(value));
  heading("Distribución por documento");
  bar("Nombramientos", report.nombramientos, report.total);
  bar("Declaraciones", report.declaraciones, report.total, true);
  heading("Distribución por estado actual");
  report.states.forEach(row => bar(row.label, row.count, report.total));
  heading("Tipos de declaración");
  if (!report.types.length) text("Sin declaraciones en el periodo.");
  report.types.forEach(row => bar(row.label, row.count, report.declaraciones));
  heading(`Actividad por ${report.grouping}`);
  text("Documentos recibidos. Rojo: nombramientos; gris: declaraciones. No representa cambios de estado.");
  const maxActivity = Math.max(1, ...report.activity.map(row => Math.max(row.nombramientos, row.declaraciones)));
  report.activity.forEach(row => {
    room(14);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9);
    doc.text(row.period, 16, y);
    doc.setFillColor(168, 39, 50);
    if (row.nombramientos) doc.rect(43, y - 3, 58 * row.nombramientos / maxActivity, 3, "F");
    doc.text(String(row.nombramientos), 105, y);
    doc.setFillColor(71, 85, 105);
    if (row.declaraciones) doc.rect(120, y - 3, 58 * row.declaraciones / maxActivity, 3, "F");
    doc.text(String(row.declaraciones), 182, y);
    y += 9;
  });
  heading("Metodología y calidad de datos"); text(REPORT_METHOD);
  text(`Registros autorizados sin recepción válida en la fuente completa: ${report.missingDates}. Excluidos de ambos periodos.`);
  text(`Comparación: ${report.previous.desde} a ${report.previous.hasta}. Base anterior cero: porcentaje no aplicable.`);
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page); doc.setFontSize(8); doc.setTextColor(82, 96, 115);
    doc.text(`Uso institucional - Página ${page} de ${pages}`, 16, 289);
  }
  return new Uint8Array(doc.output("arraybuffer"));
}
