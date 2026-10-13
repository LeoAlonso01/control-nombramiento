"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileCheck2,
  FileText,
  LayoutDashboard,
  Plus,
  Search,
  UsersRound,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CapturaNombramiento } from "@/app/captura-nombramiento";

type Status = "Vigente" | "Pendiente" | "Próximo a vencer";
type Appointment = {
  id: string;
  name: string;
  area: string;
  date: string;
  status: Status;
};

const appointments: Appointment[] = [
  { id: "NOM-2026-0148", name: "Mariana Solís Vega", area: "Dirección Administrativa", date: "10 oct 2026", status: "Vigente" },
  { id: "NOM-2026-0147", name: "Andrés Rivas Luna", area: "Unidad de Planeación", date: "09 oct 2026", status: "Pendiente" },
  { id: "NOM-2026-0146", name: "Camila Torres Rey", area: "Coordinación Jurídica", date: "08 oct 2026", status: "Próximo a vencer" },
  { id: "NOM-2026-0145", name: "Diego Navarro Paz", area: "Dirección de Recursos Humanos", date: "07 oct 2026", status: "Vigente" },
  { id: "NOM-2026-0144", name: "Valeria Cruz Sol", area: "Unidad de Transparencia", date: "06 oct 2026", status: "Pendiente" },
];

const navItems = [
  { label: "Inicio", icon: LayoutDashboard, active: true },
  { label: "Nombramientos", icon: UsersRound, active: false },
  { label: "Declaraciones", icon: FileCheck2, active: false },
  { label: "Reportes", icon: FileText, active: false },
];

const metrics = [
  { label: "Total de nombramientos", value: "248", detail: "Registros en el sistema", icon: UsersRound, tone: "text-slate-600 bg-slate-100" },
  { label: "Vigentes", value: "196", detail: "79% del total", icon: CheckCircle2, tone: "text-emerald-700 bg-emerald-50" },
  { label: "Pendientes de revisión", value: "32", detail: "Requieren seguimiento", icon: Clock3, tone: "text-amber-700 bg-amber-50" },
  { label: "Próximos a vencer", value: "20", detail: "En los próximos 30 días", icon: AlertCircle, tone: "text-red-700 bg-red-50" },
];

function StatusBadge({ status }: { status: Status }) {
  const styles: Record<Status, string> = {
    Vigente: "border-emerald-200 bg-emerald-50 text-emerald-800",
    Pendiente: "border-amber-200 bg-amber-50 text-amber-800",
    "Próximo a vencer": "border-red-200 bg-red-50 text-red-800",
  };
  return <Badge variant="outline" className={`h-6 rounded-full px-2.5 font-medium ${styles[status]}`}>{status}</Badge>;
}

function Sidebar() {
  return (
    <aside className="flex w-full shrink-0 flex-col bg-[#202833] text-white lg:min-h-screen lg:w-[252px]">
      <div className="flex items-center gap-3 border-b border-white/10 px-5 py-5 lg:px-6 lg:py-7">
        <div className="flex size-10 items-center justify-center rounded-lg bg-[#a82732] text-sm font-bold tracking-wide">CN</div>
        <div>
          <p className="text-sm font-semibold leading-tight">Control de</p>
          <p className="text-sm font-semibold leading-tight">Nombramientos</p>
        </div>
      </div>
      <nav aria-label="Navegación principal" className="flex gap-1 overflow-x-auto px-3 py-3 lg:flex-col lg:px-4 lg:py-6">
        <p className="hidden px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400 lg:block">Menú principal</p>
        {navItems.map(({ label, icon: Icon, active }) => (
          <a key={label} href={active ? "#inicio" : "#"} aria-current={active ? "page" : undefined} className={`flex min-h-10 shrink-0 items-center gap-3 rounded-md px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${active ? "bg-white/10 font-medium text-white" : "text-slate-300 hover:bg-white/5 hover:text-white"}`}>
            <Icon aria-hidden="true" className={`size-[18px] ${active ? "text-red-300" : "text-slate-400"}`} />{label}
          </a>
        ))}
      </nav>
      <div className="mt-auto hidden border-t border-white/10 px-6 py-5 lg:block">
        <p className="text-xs text-slate-400">Sistema de gestión institucional</p>
        <p className="mt-1 text-xs text-slate-500">Versión 1.0</p>
      </div>
    </aside>
  );
}

function MetricCard({ metric }: { metric: (typeof metrics)[number] }) {
  const Icon = metric.icon;
  return (
    <Card className="gap-4 rounded-xl border-0 bg-white py-5 shadow-sm ring-1 ring-slate-200/80">
      <CardHeader className="flex flex-row items-start justify-between gap-3 px-5 py-0">
        <CardTitle className="text-[13px] font-medium leading-5 text-slate-600">{metric.label}</CardTitle>
        <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${metric.tone}`}><Icon aria-hidden="true" className="size-[18px]" /></span>
      </CardHeader>
      <CardContent className="px-5">
        <p className="text-[28px] font-semibold leading-none tracking-tight text-slate-900">{metric.value}</p>
        <p className="mt-2 text-xs text-slate-500">{metric.detail}</p>
      </CardContent>
    </Card>
  );
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [captureOpen, setCaptureOpen] = useState(false);
  const [currentDate, setCurrentDate] = useState("");
  const [currentDateIso, setCurrentDateIso] = useState("");
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const now = new Date();
      setCurrentDate(new Intl.DateTimeFormat("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(now));
      setCurrentDateIso(new Intl.DateTimeFormat("en-CA").format(now));
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);
  const filteredAppointments = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("es-MX");
    if (!normalizedQuery) return appointments;
    return appointments.filter((appointment) =>
      [appointment.id, appointment.name, appointment.area, appointment.date, appointment.status]
        .some((value) => value.toLocaleLowerCase("es-MX").includes(normalizedQuery)),
    );
  }, [query]);
  if (captureOpen) return <CapturaNombramiento onClose={() => setCaptureOpen(false)} />;
  return (
    <div id="inicio" className="flex min-h-screen flex-col bg-[#f7f8fa] text-slate-900 lg:flex-row">
      <Sidebar />
      <main className="min-w-0 flex-1">
        <header className="border-b border-slate-200 bg-white px-5 py-5 sm:px-8 lg:px-10">
          <div className="mx-auto flex max-w-[1440px] flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="mb-1 text-xs font-medium text-slate-500">Inicio <span className="px-1 text-slate-300">/</span> Panel de control</p>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Panel de control</h1>
              <p className="mt-1 text-sm text-slate-500">Resumen general de nombramientos y actividad reciente.</p>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <CalendarDays aria-hidden="true" className="size-4 text-slate-400" />
              <time dateTime={currentDateIso || undefined} className="capitalize">{currentDate || "Cargando fecha…"}</time>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-[1440px] space-y-7 px-5 py-6 sm:px-8 sm:py-8 lg:px-10">
          <section aria-label="Indicadores de nombramientos" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {metrics.map((metric) => <MetricCard key={metric.label} metric={metric} />)}
          </section>

          <section aria-labelledby="recent-title">
            <Card className="gap-0 rounded-xl border-0 bg-white py-0 shadow-sm ring-1 ring-slate-200/80">
              <CardHeader className="gap-4 border-b border-slate-100 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <div>
                  <CardTitle id="recent-title" className="text-base font-semibold text-slate-900">Nombramientos recientes</CardTitle>
                  <p className="mt-1 text-sm text-slate-500">Consulta los últimos registros y su estado actual.</p>
                </div>
                <Button type="button" onClick={() => setCaptureOpen(true)} className="h-10 w-full rounded-md bg-[#a82732] px-4 text-sm text-white hover:bg-[#8e202a] focus-visible:ring-2 focus-visible:ring-red-800 focus-visible:ring-offset-2 sm:w-auto">
                  <Plus aria-hidden="true" className="size-4" /> Registrar nombramiento
                </Button>
              </CardHeader>
              <CardContent className="px-0 py-0">
                <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
                  <label htmlFor="appointment-search" className="sr-only">Buscar nombramientos</label>
                  <div className="relative max-w-sm">
                    <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                    <input id="appointment-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nombre, folio o área..." className="h-10 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 hover:border-slate-300 focus:border-red-700 focus:ring-2 focus:ring-red-700/15" />
                  </div>
                </div>
                <Table>
                  <TableHeader className="bg-slate-50/80">
                    <TableRow className="border-slate-100 hover:bg-transparent">
                      <TableHead className="h-11 pl-5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 sm:pl-6">Identificador</TableHead>
                      <TableHead className="h-11 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Nombre</TableHead>
                      <TableHead className="h-11 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Área</TableHead>
                      <TableHead className="h-11 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Fecha de registro</TableHead>
                      <TableHead className="h-11 pr-5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 sm:pr-6">Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAppointments.map((appointment) => (
                      <TableRow key={appointment.id} className="border-slate-100 hover:bg-slate-50/70">
                        <TableCell className="py-4 pl-5 font-medium text-slate-700 sm:pl-6">{appointment.id}</TableCell>
                        <TableCell className="py-4 font-medium text-slate-900">{appointment.name}</TableCell>
                        <TableCell className="py-4 text-slate-600">{appointment.area}</TableCell>
                        <TableCell className="py-4 text-slate-600">{appointment.date}</TableCell>
                        <TableCell className="py-4 pr-5 sm:pr-6"><StatusBadge status={appointment.status} /></TableCell>
                      </TableRow>
                    ))}
                    {filteredAppointments.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="h-28 text-center text-sm text-slate-500">No se encontraron nombramientos que coincidan con la búsqueda.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
                <div className="flex items-center justify-between border-t border-slate-100 px-5 py-4 sm:px-6">
                  <p aria-live="polite" className="text-xs text-slate-500">Mostrando {filteredAppointments.length} de {appointments.length} registros ficticios</p>
                  <a href="#" className="inline-flex items-center gap-1 text-xs font-medium text-[#992630] hover:text-[#761b23] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-700">Ver todos <ArrowUpRight aria-hidden="true" className="size-3.5" /></a>
                </div>
              </CardContent>
            </Card>
          </section>
          <footer className="flex items-center gap-2 pb-2 text-xs text-slate-400"><span className="size-1.5 rounded-full bg-emerald-500" /> Datos de demostración</footer>
        </div>
      </main>
    </div>
  );
}
