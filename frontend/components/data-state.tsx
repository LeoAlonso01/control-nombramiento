import type { ReactNode } from "react";
import { AlertCircle, LoaderCircle } from "lucide-react";

type DataStateProps =
  | { state: "loading"; message?: string }
  | { state: "empty"; title: string; description?: string }
  | { state: "error"; title?: string; description?: string }
  | { state: "ready"; children: ReactNode };

/** Mensajes accesibles y consistentes para cargas de datos, listas vacías y errores. */
export function DataState(props: DataStateProps) {
  if (props.state === "ready") return props.children;

  if (props.state === "loading") {
    return (
      <div role="status" aria-live="polite" aria-atomic="true" className="flex flex-col items-center justify-center px-5 py-12 text-center">
        <LoaderCircle aria-hidden="true" className="mb-3 size-5 animate-spin text-[#a82732] motion-reduce:animate-none" />
        <p className="text-sm font-medium text-slate-700">{props.message ?? "Cargando información…"}</p>
      </div>
    );
  }

  const isError = props.state === "error";
  const title = isError ? props.title ?? "No se pudo consultar la información" : props.title;
  const description = props.description;
  return (
    <div role={isError ? "alert" : "status"} aria-live={isError ? "assertive" : "polite"} className="px-5 py-12 text-center">
      {isError && <AlertCircle aria-hidden="true" className="mx-auto mb-3 size-5 text-red-700" />}
      <p className="text-sm font-medium text-slate-800">{title}</p>
      {description && <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">{description}</p>}
    </div>
  );
}
