"use client";

import { useRouter } from "next/navigation";
import { CapturaNombramiento } from "@/app/captura-nombramiento";
import { useAppRole } from "@/app/app-shell";
import { hasPermission } from "@/lib/auth/authorization";

export default function CaptureAppointmentPage() {
  const router = useRouter();
  const role = useAppRole();
  if (!hasPermission(role ?? "auditor", "nombramientos", "create")) {
    return <main className="p-6"><section role="alert" className="mx-auto max-w-xl rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200"><h1 className="font-semibold">Acceso no disponible</h1><p className="mt-2 text-sm text-slate-600">Tu perfil no tiene permiso para registrar nombramientos.</p></section></main>;
  }
  return <CapturaNombramiento onClose={() => router.push("/nombramientos")} />;
}
