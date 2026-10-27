"use client";

import { useRouter } from "next/navigation";
import { CapturaDeclaracion } from "@/app/captura-declaracion";
import { useAppRole } from "@/app/app-shell";
import { hasPermission } from "@/lib/auth/authorization";

export default function CaptureDeclarationPage() {
  const router = useRouter();
  const role = useAppRole();
  if (!hasPermission(role ?? "auditor", "declaraciones", "create")) {
    return <main className="p-6"><section role="alert" className="mx-auto max-w-xl rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200"><h1 className="font-semibold">Acceso no disponible</h1><p className="mt-2 text-sm text-slate-600">Tu perfil no tiene permiso para registrar declaraciones.</p></section></main>;
  }
  return <CapturaDeclaracion onClose={() => router.push("/declaraciones")} />;
}
