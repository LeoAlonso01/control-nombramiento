"use client";

import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  FileText,
  LoaderCircle,
  RotateCcw,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MAX_DOCUMENT_SIZE } from "@/lib/files/document-validation";
import {
  DECLARATION_TYPE_LABELS,
  DECLARATION_TYPES,
  type DeclarationType,
} from "@/lib/records/contracts";

type DeclarationData = {
  nombre_declarante: string | null;
  curp_declarante: string | null;
  lugar_declaracion: string | null;
  fecha_declaracion: string | null;
  tipo_declaracion: DeclarationType | null;
  fecha_recepcion: string | null;
};

type DeclarationFields = {
  nombre_declarante: string;
  curp_declarante: string;
  lugar_declaracion: string;
  fecha_declaracion: string;
  tipo_declaracion: Exclude<DeclarationData["tipo_declaracion"], null> | "";
  fecha_recepcion: string;
};

const REQUEST_TIMEOUT_MS = 120_000;
const SLOW_REQUEST_MS = 20_000;

const EMPTY_FIELDS: DeclarationFields = {
  nombre_declarante: "",
  curp_declarante: "",
  lugar_declaracion: "",
  fecha_declaracion: "",
  tipo_declaracion: "",
  fecha_recepcion: "",
};

const FIELD_DEFINITIONS = [
  { key: "nombre_declarante", label: "Nombre del declarante", type: "text" },
  { key: "curp_declarante", label: "CURP del declarante", type: "text" },
  { key: "lugar_declaracion", label: "Lugar de la declaración", type: "text" },
  { key: "fecha_declaracion", label: "Fecha de la declaración", type: "date" },
  { key: "tipo_declaracion", label: "Tipo de declaración", type: "select" },
  { key: "fecha_recepcion", label: "Fecha de recepción", type: "date" },
] as const;

/** Identifica los tipos admitidos por su firma binaria; el MIME del navegador no basta. */
function detectMimeType(signature: Uint8Array): string | null {
  if (
    signature.length >= 5 &&
    signature[0] === 0x25 && signature[1] === 0x50 &&
    signature[2] === 0x44 && signature[3] === 0x46 && signature[4] === 0x2d
  ) return "application/pdf";

  if (
    signature.length >= 3 && signature[0] === 0xff &&
    signature[1] === 0xd8 && signature[2] === 0xff
  ) return "image/jpeg";

  if (
    signature.length >= 8 &&
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
      .every((byte, index) => signature[index] === byte)
  ) return "image/png";

  return null;
}

function formatBytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
}

/** Convierte la respuesta externa al estado editable y descarta valores de tipo no reconocido. */
function toDeclarationFields(data: Record<string, unknown>): DeclarationFields {
  const value = (key: keyof DeclarationData) =>
    typeof data[key] === "string" ? data[key] as string : "";
  const type = data.tipo_declaracion;

  return {
    nombre_declarante: value("nombre_declarante"),
    curp_declarante: value("curp_declarante"),
    lugar_declaracion: value("lugar_declaracion"),
    fecha_declaracion: value("fecha_declaracion"),
    tipo_declaracion:
      type === "inicio" || type === "modificacion" || type === "conclusion"
        ? type
        : "",
    fecha_recepcion: value("fecha_recepcion"),
  };
}

/** Comprueba objetos JSON sin aceptar null ni arreglos como respuestas de API. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

type Props = { onClose: () => void };

export function CapturaDeclaracion({ onClose }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const requestLock = useRef(false);
  const abortController = useRef<AbortController | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSlow, setIsSlow] = useState(false);
  const [error, setError] = useState("");
  const [fields, setFields] = useState<DeclarationFields>(EMPTY_FIELDS);
  const [stage, setStage] = useState<"upload" | "review" | "admit" | "reject" | "done">("upload");
  const [decision, setDecision] = useState<"admitted" | "rejected">("admitted");
  const [operationId, setOperationId] = useState("");

  /** Valida tamaño y firma localmente para dar feedback temprano; el servidor valida de nuevo. */
  async function chooseFile(candidate?: File) {
    if (!candidate || isExtracting) return;

    if (candidate.size === 0) {
      setError("El archivo está vacío. Selecciona un archivo válido.");
      return;
    }
    if (candidate.size > MAX_DOCUMENT_SIZE) {
      setError("El archivo supera el límite de 10 MiB.");
      return;
    }

    const signature = new Uint8Array(await candidate.slice(0, 8).arrayBuffer());
    const detectedMime = detectMimeType(signature);
    if (!detectedMime) {
      setError("Formato no admitido. Utiliza PDF, JPEG/JPG o PNG válidos.");
      return;
    }

    const normalizedFile = candidate.type === detectedMime
      ? candidate
      : new File([candidate], candidate.name, {
          type: detectedMime,
          lastModified: candidate.lastModified,
        });

    setFile(normalizedFile);
    setError("");
    setFields(EMPTY_FIELDS);
    setStage("upload");
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    void chooseFile(event.target.files?.[0]);
    // Permite volver a seleccionar el mismo archivo tras quitarlo o recibir un error.
    event.target.value = "";
  }

  function dropFile(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    void chooseFile(event.dataTransfer.files[0]);
  }

  async function extract() {
    if (!file || requestLock.current) return;

    requestLock.current = true;
    setIsExtracting(true);
    setIsSlow(false);
    setError("");

    // El bloqueo en ref evita envíos duplicados incluso antes del siguiente render.
    const controller = new AbortController();
    abortController.current = controller;
    // El aviso de demora no cancela la operación; el límite posterior sí aborta la petición.
    const slowTimer = window.setTimeout(() => setIsSlow(true), SLOW_REQUEST_MS);
    const timeout = window.setTimeout(
      () => controller.abort("timeout"),
      REQUEST_TIMEOUT_MS,
    );
    const form = new FormData();
    form.append("file", file);

    try {
      const response = await fetch("/api/declaraciones/extraer", {
        method: "POST",
        body: form,
        signal: controller.signal,
      });
      const result: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        const message = isRecord(result) && isRecord(result.error) &&
          typeof result.error.message === "string"
          ? result.error.message
          : isRecord(result) && typeof result.error === "string"
            ? result.error
            : "No fue posible procesar el documento. Inténtalo de nuevo.";
        throw new Error(message);
      }

      if (
        !isRecord(result) || result.success !== true || !isRecord(result.data)
      ) {
        throw new Error("La respuesta del servicio no tiene el formato esperado.");
      }

      // La respuesta de Gemini permanece en el estado local hasta que exista un guardado real.
      setFields(toDeclarationFields(result.data));
      setStage("review");
    } catch (cause) {
      if (controller.signal.aborted) {
        setError(controller.signal.reason === "timeout"
          ? "El análisis tardó demasiado y se canceló. El documento sigue seleccionado; puedes volver a intentarlo."
          : "Se canceló el análisis. El documento sigue seleccionado y puedes intentarlo de nuevo.");
      } else {
        setError(
          cause instanceof TypeError
            ? "No se pudo conectar con el servicio. Revisa tu conexión e inténtalo de nuevo."
            : cause instanceof Error
              ? cause.message
              : "Ocurrió un error al procesar el documento.",
        );
      }
    } finally {
      window.clearTimeout(slowTimer);
      window.clearTimeout(timeout);
      abortController.current = null;
      requestLock.current = false;
      setIsExtracting(false);
      setIsSlow(false);
    }
  }

  function cancelExtraction() {
    // La respuesta de abort se distingue en el catch mediante signal.reason.
    abortController.current?.abort("user");
  }

  function startNew() {
    if (requestLock.current) return;
    setFile(null);
    setError("");
    setFields(EMPTY_FIELDS);
    setStage("upload");
    setOperationId("");
    setDecision("admitted");
  }

  function updateField<K extends keyof DeclarationFields>(key: K, value: DeclarationFields[K]) {
    setFields((current) => ({ ...current, [key]: value }));
  }

  const missingCount = FIELD_DEFINITIONS.filter(({ key }) => !fields[key].trim()).length;
  const reviewedEntries = FIELD_DEFINITIONS.map(({ key, label }) => {
    const value = fields[key].trim();
    return [
      label,
      key === "tipo_declaracion" && value
      ? DECLARATION_TYPE_LABELS[value as keyof typeof DECLARATION_TYPE_LABELS]
        : value || "No identificado",
    ] as const;
  });

  return (
    <section aria-labelledby="declaration-title" className="fixed inset-0 z-50 overflow-y-auto bg-[#f7f8fa] text-slate-900">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white px-4 py-4 sm:px-8">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button type="button" variant="outline" aria-label="Volver al panel" disabled={isExtracting} onClick={onClose} className="h-10 rounded-md px-3">
              <ArrowLeft aria-hidden="true" className="size-4" /><span className="hidden sm:inline">Volver</span>
            </Button>
            <div><p className="text-xs text-slate-500">Declaraciones / Captura</p><h1 id="declaration-title" className="text-lg font-semibold">Registrar declaración</h1></div>
          </div>
          {stage !== "done" && <span className="hidden text-xs text-slate-500 sm:block">Extracción asistida · revisión manual requerida</span>}
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-5 px-4 py-6 sm:px-8 sm:py-8">
        {stage === "upload" && <>
          <div><h2 className="text-xl font-semibold">Carga de la constancia</h2><p className="mt-1 text-sm text-slate-600">Selecciona una constancia de recepción en PDF, JPEG o PNG para identificar los datos y revisarlos.</p></div>

          <Card className="rounded-xl border-0 bg-white py-0 shadow-sm ring-1 ring-slate-200/80">
            <CardContent className="p-5 sm:p-7">
              <input
                ref={inputRef}
                type="file"
                accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png"
                onChange={handleFileChange}
                disabled={isExtracting}
                className="sr-only"
                aria-label="Seleccionar constancia PDF, JPEG o PNG"
              />

              {!file ? (
                <div
                  onDragOver={(event) => { event.preventDefault(); if (!isExtracting) setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={dropFile}
                  className={`rounded-xl border-2 border-dashed p-7 text-center transition-colors sm:p-12 ${dragging ? "border-red-500 bg-red-50/60" : "border-slate-300 bg-slate-50/70"}`}
                >
                  <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-white text-[#a82732] shadow-sm ring-1 ring-slate-200"><Upload aria-hidden="true" className="size-5" /></span>
                  <p className="mt-4 font-medium text-slate-800">Arrastra la constancia aquí</p>
                  <p className="mt-1 text-sm text-slate-500">o selecciona un archivo desde tu dispositivo</p>
                  <Button type="button" variant="outline" disabled={isExtracting} onClick={() => inputRef.current?.click()} className="mt-4 h-10 rounded-md px-4">Seleccionar archivo</Button>
                  <p className="mt-4 text-xs text-slate-500">PDF, JPEG/JPG o PNG · máximo 10 MiB</p>
                </div>
              ) : (
                <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-white text-[#a82732] ring-1 ring-slate-200"><FileText aria-hidden="true" className="size-5" /></span>
                    <div className="min-w-0"><p className="truncate text-sm font-medium text-slate-900">{file.name}</p><p className="mt-1 text-xs text-slate-500">{file.type.replace("application/", "").replace("image/", "").toUpperCase()} · {formatBytes(file.size)}</p></div>
                  </div>
                  {!isExtracting && <div className="flex flex-col gap-2 sm:flex-row">
                    <Button type="button" variant="outline" onClick={() => inputRef.current?.click()} className="h-9 rounded-md">Sustituir</Button>
                    <Button type="button" variant="outline" onClick={() => { setFile(null); setError(""); }} className="h-9 rounded-md text-slate-700"><X aria-hidden="true" className="size-4" /> Quitar</Button>
                  </div>}
                </div>
              )}

              {error && <div role="alert" className="mt-4 flex gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800"><AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" /><p>{error}</p></div>}

              {isExtracting && <div aria-live="polite" className="mt-4 rounded-lg border border-red-100 bg-red-50/60 p-4">
                <div className="flex items-start gap-3">
                  <LoaderCircle aria-hidden="true" className="mt-0.5 size-5 shrink-0 animate-spin text-[#a82732] motion-reduce:animate-none" />
                  <div className="min-w-0 flex-1"><p className="font-medium text-slate-900">Analizando la constancia con Gemini…</p><p className="mt-1 text-sm text-slate-600">Estamos identificando los datos de la declaración. Esto puede tardar unos segundos.</p><p className="mt-2 truncate text-xs text-slate-500">Documento: {file?.name ?? "Documento seleccionado"}</p>{isSlow && <p className="mt-2 text-xs text-amber-800">El análisis está tardando más de lo habitual. Puedes cancelar y volver a intentarlo.</p>}</div>
                  <Button type="button" variant="outline" onClick={cancelExtraction} className="h-9 shrink-0 rounded-md">Cancelar análisis</Button>
                </div>
              </div>}

              <div className="mt-5 flex flex-col-reverse justify-end gap-2 border-t border-slate-100 pt-5 sm:flex-row">
                <Button type="button" variant="outline" disabled={isExtracting} onClick={onClose} className="h-10 rounded-md">Cancelar</Button>
                <Button type="button" disabled={!file || isExtracting} onClick={() => void extract()} className="h-10 rounded-md bg-[#a82732] px-4 text-white hover:bg-[#8e202a]">{isExtracting ? "Analizando…" : "Extraer datos"}</Button>
              </div>
            </CardContent>
          </Card>
        </>}

        {stage === "review" && <>
          <div><h2 className="text-xl font-semibold">Revisión de los datos</h2><p className="mt-1 text-sm text-slate-600">Verifica y corrige la información identificada antes de tomar una decisión.</p></div>
          <Card className="rounded-xl border-0 bg-white py-0 shadow-sm ring-1 ring-slate-200/80">
            <CardHeader className="border-b border-slate-100 px-5 py-5 sm:px-6"><CardTitle className="text-base font-semibold">Datos de la declaración</CardTitle><p className="text-sm text-slate-500">Documento analizado: {file?.name}</p></CardHeader>
            <CardContent className="p-5 sm:p-6">
              {missingCount > 0 && <div className="mb-5 flex gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900"><AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" /><p>{missingCount} {missingCount === 1 ? "campo no fue identificado" : "campos no fueron identificados"}. Revísalos y complétalos si cuentas con la información.</p></div>}
              <div className="grid gap-4 sm:grid-cols-2">
                {FIELD_DEFINITIONS.map(({ key, label, type }) => {
                  const missing = !fields[key].trim();
                  const inputClass = `mt-1 h-10 w-full rounded-md border px-3 text-sm text-slate-900 outline-none focus:border-red-700 focus:ring-2 focus:ring-red-700/15 ${missing ? "border-amber-300 bg-amber-50/60" : "border-slate-200 bg-white"}`;
                  return <div key={key}>
                    <label htmlFor={`declaration-${key}`} className="text-sm font-medium text-slate-700">{label}{missing && <span className="ml-2 text-xs font-normal text-amber-800">No identificado</span>}</label>
                    {type === "select" ? <select id={`declaration-${key}`} value={fields.tipo_declaracion} onChange={(event) => updateField("tipo_declaracion", event.target.value as DeclarationFields["tipo_declaracion"])} className={inputClass}>
                      <option value="">No identificado</option>{DECLARATION_TYPES.map((type) => <option key={type} value={type}>{DECLARATION_TYPE_LABELS[type]}</option>)}
                    </select> : <input id={`declaration-${key}`} type={type} value={fields[key] as string} onChange={(event) => updateField(key, event.target.value as never)} className={inputClass} />}
                  </div>;
                })}
              </div>
              <div className="mt-6 flex flex-col-reverse justify-between gap-2 border-t border-slate-100 pt-5 sm:flex-row">
                <div className="flex flex-col gap-2 sm:flex-row"><Button type="button" variant="outline" onClick={() => { setStage("upload"); setError(""); }} className="h-10 rounded-md">Volver al documento</Button><Button type="button" variant="outline" onClick={() => setStage("reject")} className="h-10 rounded-md text-slate-700">Rechazar declaración</Button></div>
                <Button type="button" onClick={() => setStage("admit")} className="h-10 rounded-md bg-[#a82732] px-4 text-white hover:bg-[#8e202a]">Admitir declaración</Button>
              </div>
            </CardContent>
          </Card>
        </>}

        {/* La admisión/rechazo es una simulación local; aquí no se escribe en PocketBase. */}
        {(stage === "admit" || stage === "reject") && <Card className="mx-auto max-w-3xl rounded-xl border-0 bg-white py-0 shadow-sm ring-1 ring-slate-200/80">
          <CardHeader className="border-b border-slate-100 px-5 py-5 sm:px-6"><CardTitle className="text-lg">{stage === "admit" ? "Confirmar admisión" : "Confirmar rechazo"}</CardTitle><p className="text-sm text-slate-600">{stage === "admit" ? "Revisa el resumen antes de confirmar. El guardado será simulado y no valida la autenticidad ni el cumplimiento legal del documento." : "Confirma el rechazo de esta captura. No se guardará información."}</p></CardHeader>
          <CardContent className="p-5 sm:p-6"><dl className="grid gap-3 sm:grid-cols-2">{reviewedEntries.map(([label, value]) => <div key={label} className="rounded-md bg-slate-50 p-3"><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 break-words text-sm font-medium text-slate-800">{value}</dd></div>)}</dl><div className="mt-5 flex flex-col-reverse justify-end gap-2 border-t border-slate-100 pt-5 sm:flex-row"><Button type="button" variant="outline" onClick={() => setStage("review")} className="h-10 rounded-md">Volver a revisar</Button><Button type="button" onClick={() => { setDecision(stage === "admit" ? "admitted" : "rejected"); if (stage === "admit") setOperationId(`SIM-${globalThis.crypto?.randomUUID?.().slice(0, 8).toUpperCase() ?? Date.now().toString(36).toUpperCase()}`); setStage("done"); }} className={`h-10 rounded-md px-4 text-white ${stage === "admit" ? "bg-[#a82732] hover:bg-[#8e202a]" : "bg-slate-700 hover:bg-slate-800"}`}>{stage === "admit" ? "Confirmar admisión" : "Sí, rechazar"}</Button></div></CardContent>
        </Card>}

        {stage === "done" && <Card className="mx-auto max-w-3xl rounded-xl border-0 bg-white py-0 shadow-sm ring-1 ring-slate-200/80">
          <CardHeader className="items-center border-b border-slate-100 px-5 py-7 text-center"><span className={`mb-2 flex size-12 items-center justify-center rounded-full ${decision === "admitted" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-700"}`}>{decision === "admitted" ? <CheckCircle2 aria-hidden="true" className="size-6" /> : <X aria-hidden="true" className="size-6" />}</span><CardTitle className="text-xl">{decision === "admitted" ? "Admisión confirmada" : "Declaración rechazada"}</CardTitle><p className="max-w-xl text-sm text-slate-600">{decision === "admitted" ? <>Guardado simulado. El registro no se almacenó permanentemente y existe solo en el estado de esta pantalla. Identificador de operación: <strong>{operationId}</strong>.</> : "El flujo se marcó como rechazado. No se guardaron datos."}</p></CardHeader>
          <CardContent className="p-5 sm:p-6"><h3 className="mb-3 font-semibold">{decision === "admitted" ? "Resumen de los datos aceptados" : "Resumen revisado"}</h3><dl className="grid gap-3 sm:grid-cols-2">{reviewedEntries.map(([label, value]) => <div key={label} className="rounded-md bg-slate-50 p-3"><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 break-words text-sm font-medium text-slate-800">{value}</dd></div>)}</dl><div className="mt-5 flex flex-col-reverse justify-end gap-2 border-t border-slate-100 pt-5 sm:flex-row"><Button type="button" variant="outline" onClick={onClose} className="h-10 rounded-md">Volver al panel</Button><Button type="button" onClick={startNew} className="h-10 rounded-md bg-[#a82732] px-4 text-white hover:bg-[#8e202a]"><RotateCcw aria-hidden="true" className="size-4" /> Nueva captura</Button></div></CardContent>
        </Card>}
      </main>
    </section>
  );
}
