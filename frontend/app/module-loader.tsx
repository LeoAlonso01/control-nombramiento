import { LoaderCircle } from "lucide-react";

/** Indicador visual para navegación y cargas de datos reales. */
export function ModuleLoader({ message = "Preparando el módulo…" }: { message?: string }) {
  return (
    <div role="status" aria-live="polite" aria-atomic="true" className="flex min-h-[52vh] items-center justify-center px-5 py-10">
      <div className="flex items-center gap-3 rounded-xl bg-white px-5 py-4 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-slate-200/80">
        <LoaderCircle aria-hidden="true" className="size-5 animate-spin text-[#a82732] motion-reduce:animate-none" />
        <span>{message}</span>
      </div>
    </div>
  );
}
