"use client";

import { createContext, useContext, useRef, useState, type MouseEvent, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FileCheck2, FileText, LayoutDashboard, LoaderCircle, LogOut, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { hasPermission, type AppRole } from "@/lib/auth/authorization";
import { createLogoutRequest, isLogoutSuccessful, LOGOUT_ENDPOINT } from "@/lib/auth/logout-contract";

const navItems = [
  { label: "Inicio", href: "/", icon: LayoutDashboard },
  { label: "Nombramientos", href: "/nombramientos", icon: UsersRound },
  { label: "Declaraciones", href: "/declaraciones", icon: FileCheck2 },
  { label: "Reportes", href: "/reportes", icon: FileText },
];

const RoleContext = createContext<AppRole | null>(null);

export function useAppRole() {
  return useContext(RoleContext);
}

export function AppShell({ children, role }: { children: ReactNode; role: AppRole | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const logoutSubmittingRef = useRef(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");

  async function handleLogout(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    if (logoutSubmittingRef.current) return;
    logoutSubmittingRef.current = true;
    setIsLoggingOut(true);
    setLogoutError("");
    try {
      const response = await fetch(LOGOUT_ENDPOINT, createLogoutRequest());
      let payload: { success?: unknown } | null = null;
      try { payload = (await response.json()) as { success?: unknown }; } catch { payload = null; }
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
    <div className="flex min-h-screen flex-col bg-[#f7f8fa] text-slate-900 lg:flex-row">
      <aside className="flex w-full shrink-0 flex-col bg-[#202833] text-white lg:min-h-screen lg:w-[252px]">
        <div className="flex items-center gap-3 border-b border-white/10 px-5 py-5 lg:px-6 lg:py-7">
          <div aria-hidden="true" className="flex size-10 items-center justify-center rounded-lg bg-[#a82732] text-sm font-bold tracking-wide">CN</div>
          <div><p className="text-sm font-semibold leading-tight">Control de</p><p className="text-sm font-semibold leading-tight">Nombramientos</p></div>
        </div>
        <nav aria-label="Navegación principal" className="flex gap-1 overflow-x-auto px-3 py-3 lg:flex-col lg:px-4 lg:py-6">
          <p className="hidden px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400 lg:block">Menú principal</p>
          {navItems.map(({ label, href, icon: Icon }) => {
            const active = pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
            return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`flex min-h-10 shrink-0 items-center gap-3 rounded-md px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${active ? "bg-white/10 font-medium text-white" : "text-slate-300 hover:bg-white/5 hover:text-white"}`}>
              <Icon aria-hidden="true" className={`size-[18px] ${active ? "text-red-300" : "text-slate-400"}`} />{label}
            </Link>;
          })}
        </nav>
        <div className="px-3 pb-3 lg:px-4">
          {hasPermission(role ?? "auditor", "nombramientos", "create") && <Link href="/captura-nombramiento" className="mb-2 flex min-h-10 items-center gap-3 rounded-md bg-[#a82732] px-3 text-sm font-medium text-white hover:bg-[#8e202a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"><UsersRound aria-hidden="true" className="size-4" />Registrar nombramiento</Link>}
          {hasPermission(role ?? "auditor", "declaraciones", "create") && <Link href="/captura-declaracion" className="mb-2 flex min-h-10 items-center gap-3 rounded-md bg-white/5 px-3 text-sm text-slate-200 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"><FileCheck2 aria-hidden="true" className="size-4" />Registrar declaración</Link>}
          <Button type="button" onClick={handleLogout} disabled={isLoggingOut} aria-busy={isLoggingOut} className="h-10 w-full justify-start rounded-md bg-white/5 px-3 text-sm text-slate-200 hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-white">
            {isLoggingOut ? <><LoaderCircle aria-hidden="true" className="size-4 animate-spin" />Cerrando sesión…</> : <><LogOut aria-hidden="true" className="size-4" />Cerrar sesión</>}
          </Button>
          {logoutError && <p role="alert" aria-live="polite" className="mt-2 px-2 text-xs text-red-200">{logoutError}</p>}
        </div>
        <div className="mt-auto hidden border-t border-white/10 px-6 py-5 lg:block"><p className="text-xs text-slate-400">Sistema de gestión institucional</p><p className="mt-1 text-xs text-slate-500">Versión 1.0</p></div>
      </aside>
      <RoleContext.Provider value={role}><main className="min-w-0 flex-1">{children}</main></RoleContext.Provider>
    </div>
  );
}
