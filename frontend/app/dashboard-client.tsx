"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  FileCheck2,
  FileText,
  FilePlus2,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  Plus,
  UsersRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CapturaNombramiento } from "@/app/captura-nombramiento";
import { CapturaDeclaracion } from "@/app/captura-declaracion";
import { createLogoutRequest, isLogoutSuccessful, LOGOUT_ENDPOINT } from "@/lib/auth/logout-contract";

const navItems = [
  { label: "Inicio", icon: LayoutDashboard, active: true },
  { label: "Nombramientos", icon: UsersRound, active: false },
  { label: "Declaraciones", icon: FileCheck2, active: false },
  { label: "Reportes", icon: FileText, active: false },
];

function Sidebar() {
  const router = useRouter();
  const logoutSubmittingRef = useRef(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");

  /** Cierra la sesión por el endpoint y navega solo si este confirma el borrado de cookies. */
  async function handleLogout(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    if (logoutSubmittingRef.current) return;

    logoutSubmittingRef.current = true;
    setIsLoggingOut(true);
    setLogoutError("");

    try {
      const response = await fetch(LOGOUT_ENDPOINT, createLogoutRequest());
      let payload: { success?: unknown } | null = null;

      try {
        payload = (await response.json()) as { success?: unknown };
      } catch {
        payload = null;
      }

      if (!isLogoutSuccessful(response.ok, payload)) {
        setLogoutError("No se pudo cerrar la sesión. Intenta de nuevo.");
        return;
      }

      router.replace("/login");
      router.refresh();
    } catch {
      setLogoutError("No se pudo conectar con el servicio. Intenta de nuevo.");
    } finally {
      logoutSubmittingRef.current = false;
      setIsLoggingOut(false);
    }
  }

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
      <div className="px-3 pb-3 lg:px-4">
        <Button
          type="button"
          onClick={handleLogout}
          disabled={isLoggingOut}
          aria-busy={isLoggingOut}
          className="h-10 w-full justify-start rounded-md bg-white/5 px-3 text-sm text-slate-200 hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-white"
        >
          {isLoggingOut ? (
            <><LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> Cerrando sesión…</>
          ) : (
            <><LogOut aria-hidden="true" className="size-4" /> Cerrar sesión</>
          )}
        </Button>
        {logoutError && <p role="alert" aria-live="polite" className="mt-2 px-2 text-xs text-red-200">{logoutError}</p>}
      </div>
      <div className="mt-auto hidden border-t border-white/10 px-6 py-5 lg:block">
        <p className="text-xs text-slate-400">Sistema de gestión institucional</p>
        <p className="mt-1 text-xs text-slate-500">Versión 1.0</p>
      </div>
    </aside>
  );
}

export default function Home() {
  const [captureOpen, setCaptureOpen] = useState(false);
  const [declarationCaptureOpen, setDeclarationCaptureOpen] = useState(false);
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
  if (captureOpen) return <CapturaNombramiento onClose={() => setCaptureOpen(false)} />;
  if (declarationCaptureOpen) return <CapturaDeclaracion onClose={() => setDeclarationCaptureOpen(false)} />;
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
          <section aria-labelledby="recent-title">
            <Card className="gap-0 rounded-xl border-0 bg-white py-0 shadow-sm ring-1 ring-slate-200/80">
              <CardHeader className="gap-4 border-b border-slate-100 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <div>
                  <CardTitle id="recent-title" className="text-base font-semibold text-slate-900">Nombramientos</CardTitle>
                  <p className="mt-1 text-sm text-slate-500">Consulta los registros disponibles.</p>
                </div>
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                  <Button type="button" onClick={() => setDeclarationCaptureOpen(true)} variant="outline" className="h-10 w-full rounded-md border-[#a82732]/30 px-4 text-sm text-[#8e202a] hover:bg-red-50 hover:text-[#761b23] focus-visible:ring-2 focus-visible:ring-red-800 focus-visible:ring-offset-2 sm:w-auto">
                    <FilePlus2 aria-hidden="true" className="size-4" /> Registrar declaración
                  </Button>
                  <Button type="button" onClick={() => setCaptureOpen(true)} className="h-10 w-full rounded-md bg-[#a82732] px-4 text-sm text-white hover:bg-[#8e202a] focus-visible:ring-2 focus-visible:ring-red-800 focus-visible:ring-offset-2 sm:w-auto">
                    <Plus aria-hidden="true" className="size-4" /> Registrar nombramiento
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="px-5 py-14 text-center sm:px-6">
                <div role="status" aria-live="polite" className="mx-auto max-w-md">
                  <h2 className="text-base font-semibold text-slate-800">Aún no hay nombramientos para mostrar</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-500">Los registros aparecerán aquí cuando estén disponibles en una fuente de datos conectada</p>
                </div>
              </CardContent>
            </Card>
          </section>
        </div>
      </main>
    </div>
  );
}
