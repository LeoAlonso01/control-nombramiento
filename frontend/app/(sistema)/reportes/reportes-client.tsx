"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { BarChart3, Download, Lightbulb, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { DataState } from "@/components/data-state";
import type { Count, Report, ReportFilters } from "@/lib/reports/report";
import { percent, reportPeriod, REPORT_METHOD } from "@/lib/reports/export";

function Panel({ title, children, icon }: { title: string; children: ReactNode; icon?: ReactNode }) {
  return <Card className="rounded-xl bg-white text-sm shadow-sm"><CardHeader><h2 className="flex items-center gap-2 text-base font-semibold">{icon}{title}</h2></CardHeader><CardContent>{children}</CardContent></Card>;
}

function Distribution({ rows, total, caption }: { rows: Count[]; total: number; caption: string }) {
  if (!rows.length) return <p className="text-sm text-slate-500">Sin registros para esta distribución.</p>;
  return <table className="w-full table-fixed text-left text-sm">
    <caption className="sr-only">{caption}</caption>
    <thead><tr className="text-xs text-slate-500"><th scope="col" className="w-3/5 pb-2">Categoría</th><th scope="col" className="pb-2 text-right">Cantidad</th><th scope="col" className="pb-2 text-right">%</th></tr></thead>
    <tbody>{rows.map(row => <tr key={row.label} className="border-t border-slate-100">
      <th scope="row" className="break-words py-3 pr-3 font-normal">{row.label}<div aria-hidden="true" className="mt-2 h-1.5 rounded bg-slate-100"><div className="h-full rounded bg-[#a82732]" style={{ width: `${total ? row.count / total * 100 : 0}%` }} /></div></th>
      <td className="text-right tabular-nums">{row.count}</td><td className="text-right tabular-nums">{percent(total ? row.count / total * 100 : null)}</td>
    </tr>)}</tbody>
  </table>;
}

export function ReportesClient({ initialFilters }: { initialFilters: ReportFilters }) {
  const [draft, setDraft] = useState(initialFilters);
  const [query, setQuery] = useState({ filters: initialFilters, version: 0 });
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState<"xlsx" | "pdf" | null>(null);
  const [exportError, setExportError] = useState("");
  const pendingFilters = draft.desde !== query.filters.desde || draft.hasta !== query.filters.hasta;

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    fetch(`/api/reportes?${new URLSearchParams(query.filters)}`, { cache: "no-store", signal: controller.signal })
      .then(async response => {
        if (!response.ok) {
          const body = await response.json().catch(() => null);
          throw new Error(body?.error ?? "No fue posible consultar los reportes.");
        }
        return response.json() as Promise<Report>;
      })
      .then(value => { if (active) setReport(value); })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : "No fue posible consultar los reportes."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [query]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true); setError(""); setReport(null); setExportError("");
    setQuery(value => ({ filters: { ...draft }, version: value.version + 1 }));
  }

  async function download(format: "xlsx" | "pdf") {
    if (!report || exporting || loading || pendingFilters) return;
    setExporting(format); setExportError("");
    try {
      const { createReportExcel, createReportPdf } = await import("@/lib/reports/export");
      const bytes = format === "xlsx" ? await createReportExcel(report) : await createReportPdf(report);
      const blob = new Blob([new Uint8Array(bytes)], { type: format === "xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "application/pdf" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url; link.download = `reportes-${report.filters.desde}-${report.filters.hasta}.${format}`;
      document.body.appendChild(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch { setExportError("No se pudo generar el archivo. Inténtalo de nuevo."); }
    finally { setExporting(null); }
  }

  const maxActivity = Math.max(1, ...(report?.activity.map(row => Math.max(row.nombramientos, row.declaraciones)) ?? []));
  const icon = <BarChart3 aria-hidden="true" className="size-4 text-[#a82732]" />;
  const inputClass = "mt-1.5 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm focus-visible:outline-red-700";

  return <>
    <header className="border-b border-slate-200 bg-white px-5 py-6 sm:px-8 lg:px-10"><div className="mx-auto max-w-[1440px]"><p className="mb-1 text-xs font-medium text-slate-500">Módulos / Reportes</p><h1 className="text-2xl font-semibold tracking-tight">Reportes</h1><p className="mt-1 text-sm text-slate-600">Recepción de nombramientos y declaraciones, con sus estados actuales.</p></div></header>
    <div className="mx-auto max-w-[1440px] space-y-6 px-5 py-6 sm:px-8 sm:py-8 lg:px-10">
      <Panel title="Periodo de recepción">
        <form onSubmit={submit} className="grid items-end gap-4 sm:grid-cols-[1fr_1fr_auto]">
          <label className="text-sm font-medium text-slate-700" htmlFor="report-desde">Desde<input id="report-desde" name="desde" type="date" min="1900-01-01" max={draft.hasta || "9998-12-31"} required value={draft.desde} onChange={event => setDraft(value => ({ ...value, desde: event.target.value }))} className={inputClass} /></label>
          <label className="text-sm font-medium text-slate-700" htmlFor="report-hasta">Hasta<input id="report-hasta" name="hasta" type="date" min={draft.desde || "1900-01-01"} max="9998-12-31" required value={draft.hasta} onChange={event => setDraft(value => ({ ...value, hasta: event.target.value }))} className={inputClass} /></label>
          <Button type="submit" disabled={loading || !!exporting} className="h-10 rounded-md bg-[#a82732] px-4 text-white"><RefreshCw aria-hidden="true" className="size-4" />{loading ? "Consultando…" : "Consultar"}</Button>
        </form>
        <p className="mt-3 text-xs text-slate-500">Ambas fechas incluidas · Máximo 366 días · {pendingFilters ? "Hay filtros pendientes de aplicar." : "Se excluyen expedientes eliminados."}</p>
      </Panel>
      {loading ? <DataState state="loading" message="Consultando los datos completos del reporte…" /> : error ? <DataState state="error" title="Reporte no disponible" description={error} /> : report && <>
        <div className="text-sm text-slate-600" role="status">Periodo aplicado: {reportPeriod(report)} · Consulta: {new Date(report.queriedAt).toLocaleString("es-MX", { timeZone: "America/Mexico_City" })} (Ciudad de México)</div>
        {report.missingDates > 0 && <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Calidad de datos: {report.missingDates} registros autorizados de la fuente completa no tienen fecha de recepción válida. Se excluyeron del periodo actual y del anterior.</p>}
        <Panel title="Hallazgos importantes" icon={<Lightbulb aria-hidden="true" className="size-4 text-[#a82732]" />}>
          <ul className="space-y-3">{report.insights.map(insight => <li key={insight} className="border-l-2 border-[#a82732] pl-3 text-sm text-slate-700">{insight}</li>)}</ul>
          <p className="mt-3 text-xs text-slate-500">Variación porcentual frente al periodo anterior: {percent(report.previous.percent)}</p>
        </Panel>
        <section aria-labelledby="report-kpis"><h2 id="report-kpis" className="mb-3 text-base font-semibold">Indicadores clave</h2><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[["Total de expedientes", report.total], ["Nombramientos", report.nombramientos], ["Declaraciones", report.declaraciones], ["Confirmados / total", percent(report.confirmedPercent)]].map(([label, value]) => <Card key={label} className="rounded-xl bg-white shadow-sm"><CardContent><h3 className="text-sm text-slate-500">{label}</h3><p className="mt-3 text-2xl font-semibold tabular-nums text-slate-900">{value}</p></CardContent></Card>)}</div></section>
        {!report.total && <DataState state="empty" title="Sin recepciones en este periodo" description="La consulta se completó. Prueba otro intervalo; los indicadores muestran cero real." />}
        <Panel title={`Actividad del periodo por ${report.grouping}`} icon={icon}>
          <p className="mb-4 text-sm text-slate-500">Documentos recibidos. Rojo: nombramientos; gris: declaraciones. Los números permiten consultar los valores sin depender del color.</p>
          <div className="overflow-x-auto"><table className="w-full min-w-[480px] table-fixed text-left text-sm"><caption className="sr-only">Actividad por fecha de recepción, incluyendo intervalos sin registros</caption><thead><tr className="text-xs text-slate-500"><th scope="col" className="w-28 pb-3">Periodo</th><th scope="col" className="pb-3">Nombramientos</th><th scope="col" className="pb-3">Declaraciones</th><th scope="col" className="w-16 pb-3 text-right">Total</th></tr></thead><tbody>{report.activity.map(row => <tr key={row.period} className="border-t border-slate-100"><th scope="row" className="py-3 font-normal">{row.period}</th>{(["nombramientos", "declaraciones"] as const).map(collection => <td key={collection} className="px-2 py-3 tabular-nums"><span>{row[collection]}</span><div aria-hidden="true" className="mt-1 h-2 rounded bg-slate-100"><div className={`h-full rounded ${collection === "nombramientos" ? "bg-[#a82732]" : "bg-slate-600"}`} style={{ width: `${row[collection] / maxActivity * 100}%` }} /></div></td>)}<td className="text-right tabular-nums">{row.nombramientos + row.declaraciones}</td></tr>)}</tbody></table></div>
        </Panel>
        <section aria-labelledby="report-distribution"><h2 id="report-distribution" className="mb-3 text-base font-semibold">Distribución por tipo y estado</h2><div className="grid gap-4 xl:grid-cols-3"><Panel title="Clase de documento"><Distribution caption="Distribución por clase de documento" total={report.total} rows={[{ label: "Nombramientos", count: report.nombramientos }, { label: "Declaraciones", count: report.declaraciones }]} /></Panel><Panel title="Tipo de declaración"><Distribution caption="Tipos, solo sobre el total de declaraciones" total={report.declaraciones} rows={report.types} /></Panel><Panel title="Estado actual"><Distribution caption="Estados actuales, sin mezclar estado OCR" total={report.total} rows={report.states} /></Panel></div></section>
        <Panel title="Generación de reportes" icon={<Download aria-hidden="true" className="size-4 text-[#a82732]" />}>
          <p className="text-sm text-slate-600">Los archivos usan los mismos datos y filtros aplicados en esta pantalla. El Excel incluye detalle técnico sin datos personales; el PDF incluye el resumen y las gráficas.</p>
          <div className="mt-4 flex flex-wrap gap-3">{(["xlsx", "pdf"] as const).map(format => <Button key={format} variant="outline" disabled={!report.total || !!exporting || pendingFilters} onClick={() => download(format)} className="h-10 rounded-md px-4"><Download aria-hidden="true" className="size-4" />{exporting === format ? "Generando…" : format === "xlsx" ? "Descargar Excel" : "Descargar PDF"}</Button>)}</div>
          {!report.total && <p className="mt-2 text-xs text-slate-500">Se necesita al menos un expediente en el periodo para exportar.</p>}
          {pendingFilters && <p className="mt-2 text-xs text-slate-500">Aplica los nuevos filtros antes de exportar.</p>}
          {exportError && <p role="alert" className="mt-3 text-sm text-red-700">{exportError}</p>}
          <p role="status" className="sr-only">{exporting ? "Generando archivo" : ""}</p>
        </Panel>
        <p className="text-xs leading-5 text-slate-500">{REPORT_METHOD}</p>
      </>}
    </div>
  </>;
}
