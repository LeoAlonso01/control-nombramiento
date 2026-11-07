"use client";

import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import {
  AlertCircle, ArrowLeft, CheckCircle2, FileText, LoaderCircle,
  RotateCcw, Upload, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MAX_DOCUMENT_SIZE } from "@/lib/files/document-validation";
import {
  toAppointmentEditableFields,
  validateAppointmentExtraction,
  type AppointmentEditableFields,
} from "@/lib/records/contracts";

type AppointmentFields = AppointmentEditableFields;

const emptyFields: AppointmentFields = {
  numero_nombramiento: "", fecha_emision: "", lugar_emision: "", nombre_funcionario: "",
  cargo: "", departamento: "", dependencia: "", fecha_inicio: "",
  tipo_nombramiento: "", observaciones: "",
};

// Orden y etiquetas compartidos por la ediciÃƒÂ³n, el resumen y el conteo de campos vacÃƒÂ­os.
const fields: { key: keyof AppointmentFields; label: string; type?: "date" }[] = [
  { key: "numero_nombramiento", label: "NÃƒÂºmero de nombramiento" },
  { key: "fecha_emision", label: "Fecha de emisiÃƒÂ³n", type: "date" },
  { key: "lugar_emision", label: "Lugar de emisiÃƒÂ³n" },
  { key: "nombre_funcionario", label: "Nombre completo" },
  { key: "cargo", label: "Cargo" },
  { key: "departamento", label: "Departamento" },
  { key: "dependencia", label: "Dependencia" },
  { key: "fecha_inicio", label: "Fecha de inicio", type: "date" },
  { key: "tipo_nombramiento", label: "Tipo de nombramiento" },
];

const acceptedMimeTypes = new Set([
  "application/pdf", "image/jpeg", "image/png", "image/webp",
]);
const mimeByExtension: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

function matchesFileSignature(mimeType: string, signature: Uint8Array) {
  if (mimeType === "application/pdf") {
    return signature.length >= 5 && signature[0] === 0x25 && signature[1] === 0x50 &&
      signature[2] === 0x44 && signature[3] === 0x46 && signature[4] === 0x2d;
  }
  if (mimeType === "image/jpeg") {
    return signature.length >= 3 && signature[0] === 0xff && signature[1] === 0xd8 && signature[2] === 0xff;
  }
  if (mimeType === "image/png") {
    return signature.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
      .every((byte, index) => signature[index] === byte);
  }
  if (mimeType === "image/webp") {
    return signature.length >= 12 && signature[0] === 0x52 && signature[1] === 0x49 &&
      signature[2] === 0x46 && signature[3] === 0x46 && signature[8] === 0x57 &&
      signature[9] === 0x45 && signature[10] === 0x42 && signature[11] === 0x50;
  }
  return false;
}

type Props = { onClose: () => void };

export function CapturaNombramiento({ onClose }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const redirectTimer = useRef<number | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldsValue, setFieldsValue] = useState<AppointmentFields>(emptyFields);
  const [stage, setStage] = useState<"upload" | "review" | "admit" | "reject" | "done">("upload");
  const [decision, setDecision] = useState<"admitted" | "rejected">("admitted");
  const [operationId, setOperationId] = useState("");

  const [notice, setNotice] = useState<{ kind: "info" | "success" | "error"; message: string } | null>(null);

  function scheduleRedirectToList(delayMs = 1400) {
    if (redirectTimer.current !== null) {
      window.clearTimeout(redirectTimer.current);
      redirectTimer.current = null;
    }
    redirectTimer.current = window.setTimeout(() => onClose(), delayMs);
  }

  useEffect(() => {
    return () => {
      if (redirectTimer.current !== null) {
        window.clearTimeout(redirectTimer.current);
        redirectTimer.current = null;
      }
    };
  }, []);

  /** Acepta formatos conocidos y normaliza el MIME usando la firma, no el nombre. */
  async function chooseFile(candidate?: File) {
    if (!candidate) return;
    if (candidate.size === 0) {
      setError("El archivo estÃƒÂ¡ vacÃƒÂ­o. Selecciona un archivo vÃƒÂ¡lido.");
      return;
    }
    if (candidate.size > MAX_DOCUMENT_SIZE) {
      setError("El archivo supera el lÃƒÂ­mite de 10 MiB.");
      return;
    }
    const signature = new Uint8Array(await candidate.slice(0, 12).arrayBuffer());
    const mimeType = [...acceptedMimeTypes].find((type) => matchesFileSignature(type, signature));
    if (!mimeType) {
      const extension = candidate.name.split(".").pop()?.toLowerCase() ?? "";
      if (acceptedMimeTypes.has(candidate.type) || mimeByExtension[extension]) {
        setError("El contenido del archivo no coincide con un PDF, JPEG, PNG o WebP vÃƒÂ¡lido.");
      } else {
        setError("Formato no admitido. Utiliza PDF, JPEG/JPG, PNG o WebP.");
      }
      return;
    }
    // La firma determina el formato; normalizamos el MIME para la validaciÃƒÂ³n del endpoint.
    setFile(candidate.type === mimeType
      ? candidate
      : new File([candidate], candidate.name, { type: mimeType, lastModified: candidate.lastModified }));
    setError("");
    setFieldsValue(emptyFields);
    setStage("upload");
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    chooseFile(event.target.files?.[0]);
    event.target.value = "";
  }

  async function extract() {
    if (!file || loading) return;
    setLoading(true);
    setError("");
    const form = new FormData();
    form.append("file", file);
    try {
      // El resultado es una propuesta para revisiÃƒÂ³n; esta pantalla aÃƒÂºn no la persiste.
      const response = await fetch("/api/nombramientos/extraer", { method: "POST", body: form });
      const result: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const message = typeof result === "object" && result !== null && "error" in result && typeof result.error === "string"
          ? result.error : "No fue posible procesar el documento. IntÃƒÂ©ntalo de nuevo.";
        throw new Error(message);
      }
      if (typeof result !== "object" || result === null || !("data" in result) || typeof result.data !== "object" || result.data === null) {
        throw new Error("La respuesta del servicio no tiene el formato esperado.");
      }
      const extraction = validateAppointmentExtraction(result.data);
      if (!extraction) {
        throw new Error("La respuesta del servicio no tiene el formato esperado.");
      }
      setFieldsValue(toAppointmentEditableFields(extraction));
      setStage("review");
    } catch (cause) {
      setError(cause instanceof TypeError ? "No se pudo conectar con el servicio. Revisa tu conexiÃƒÂ³n e intÃƒÂ©ntalo de nuevo." : cause instanceof Error ? cause.message : "OcurriÃƒÂ³ un error al procesar el documento.");
    } finally {
      setLoading(false);
    }
  }


  function readApiErrorMessage(payload: unknown, fallback: string): string {
    if (typeof payload !== "object" || payload === null) return fallback;
    if (!("error" in payload)) return fallback;
    const value = (payload as Record<string, unknown>).error;
    return typeof value === "string" && value.trim().length ? value : fallback;
  }

  function isCreatedNombramientoResponse(value: unknown): value is { id: string } {
    return typeof value === "object" && value !== null &&
      "id" in value && typeof (value as Record<string, unknown>).id === "string";
  }

  async function persistNombramientoToPocketBase(): Promise<string> {
    if (!file) {
      throw new Error("No hay documento seleccionado.");
    }

    setNotice({ kind: "info", message: "Guardando nombramiento…" });

    const form = new FormData();
    form.append("documento", file);

    const numero = fieldsValue.numero_nombramiento.trim();
    if (numero) form.append("numero_nombramiento", numero);

    const nombre = fieldsValue.nombre_funcionario.trim();
    if (nombre) form.append("nombre_funcionario", nombre);

    const cargoValue = fieldsValue.cargo.trim();
    if (cargoValue) form.append("cargo", cargoValue);

    const fechaRecepcion = fieldsValue.fecha_emision.trim();
    if (fechaRecepcion) form.append("fecha_recepcion", fechaRecepcion);

    const fechaNombramiento = fieldsValue.fecha_inicio.trim();
    if (fechaNombramiento) form.append("fecha_nombramiento", fechaNombramiento);

    const observaciones = fieldsValue.observaciones.trim();
    if (observaciones) form.append("observaciones", observaciones);

    // Conserva campos UI no mapeados a columnas dedicadas.
    form.append(
      "datos_ocr",
      JSON.stringify({
        captura: {
          lugar_emision: fieldsValue.lugar_emision.trim() || null,
          departamento: fieldsValue.departamento.trim() || null,
          dependencia: fieldsValue.dependencia.trim() || null,
          tipo_nombramiento: fieldsValue.tipo_nombramiento.trim() || null,
        },
        origen: { nombreArchivo: file.name, tipo: file.type, tamano: file.size },
      }),
    );

    const response = await fetch("/api/nombramientos", {
      method: "POST",
      body: form,
      cache: "no-store",
    });

    const payload: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      setNotice({ kind: "error", message: "No fue posible guardar el nombramiento." });
      throw new Error(
        readApiErrorMessage(payload, "No fue posible guardar el nombramiento. Intenta de nuevo."),
      );
    }

    if (!isCreatedNombramientoResponse(payload)) {
      setNotice({ kind: "error", message: "La respuesta del servicio no tiene el formato esperado." });
      throw new Error("La respuesta del servicio no tiene el formato esperado.");
    }

    setNotice({ kind: "success", message: "Nombramiento guardado correctamente." });
    return payload.id;
  }  function startNew() {
    setFile(null); setError(""); setFieldsValue(emptyFields); setStage("upload"); setOperationId("");
  }

  function dropFile(event: DragEvent<HTMLDivElement>) {
    event.preventDefault(); setDragging(false); chooseFile(event.dataTransfer.files[0]);
  }

  const missingCount = fields.filter(({ key }) => !fieldsValue[key].trim()).length;
  const acceptedEntries = fields.map(({ key, label }) => [label, fieldsValue[key].trim() || "No identificado"] as const);

  return (
    <section aria-labelledby="capture-title" className="fixed inset-0 z-50 overflow-y-auto bg-[#f7f8fa] text-slate-900">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white px-4 py-4 sm:px-8">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button type="button" variant="outline" aria-label="Volver al panel" onClick={onClose} className="h-10 rounded-md px-3"><ArrowLeft className="size-4" /><span className="hidden sm:inline">Volver</span></Button>
            <div><p className="text-xs text-slate-500">Nombramientos / Captura</p><h1 id="capture-title" className="text-lg font-semibold">Capturar nombramiento</h1></div>
          </div>
          {stage !== "done" && <span className="hidden text-xs text-slate-500 sm:block">ExtracciÃƒÂ³n asistida Ã‚Â· revisiÃƒÂ³n manual requerida</span>}
        </div>
      

        {notice && (
          <div className="mx-auto mt-3 max-w-5xl">
            <section
              role={notice.kind === "error" ? "alert" : undefined}
              className={`rounded-md px-4 py-3 text-sm ring-1 ${
                notice.kind === "success"
                  ? "bg-emerald-50 text-emerald-900 ring-emerald-200"
                  : notice.kind === "error"
                    ? "bg-red-50 text-red-900 ring-red-200"
                    : "bg-slate-50 text-slate-800 ring-slate-200"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 flex-1">{notice.message}</p>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setNotice(null)}
                  className="h-7 px-2 text-xs"
                >
                  Cerrar
                </Button>
              </div>
            </section>
          </div>
        )}
      </header>
      <main className="mx-auto max-w-5xl space-y-5 px-4 py-6 sm:px-8 sm:py-8">
        {stage === "upload" && <>
          <div><h2 className="text-xl font-semibold">Carga del documento</h2><p className="mt-1 text-sm text-slate-600">Selecciona un nombramiento en PDF para extraer sus datos y revisarlos.</p></div>
          <Card className="rounded-xl border-0 py-0 shadow-sm ring-1 ring-slate-200/80">
            <CardContent className="p-5 sm:p-7">
              <input ref={inputRef} type="file" accept="application/pdf,.pdf,image/jpeg,.jpg,.jpeg,image/png,.png,image/webp,.webp" onChange={handleFileChange} className="sr-only" aria-label="Seleccionar PDF, JPEG, PNG o WebP" />
              {!file ? <div onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={dropFile} className={`flex min-h-56 flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 text-center transition-colors ${dragging ? "border-red-600 bg-red-50" : "border-slate-300 bg-slate-50/60"}`}>
                <span className="mb-3 flex size-12 items-center justify-center rounded-full bg-white text-slate-600 shadow-sm"><Upload aria-hidden="true" className="size-5" /></span>
                <p className="font-medium text-slate-800">Arrastra tu documento o imagen aquÃƒÂ­</p><p className="mt-1 text-sm text-slate-500">PDF, JPEG/JPG, PNG o WebP Ã‚Â· mÃƒÂ¡ximo 10 MiB</p>
                <Button type="button" variant="outline" onClick={() => inputRef.current?.click()} className="mt-4 h-10 rounded-md">Seleccionar archivo</Button>
              </div> : <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3"><span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-800"><FileText aria-hidden="true" className="size-5" /></span><div className="min-w-0"><p className="truncate text-sm font-medium">{file.name}</p><p className="text-xs text-slate-500">{(file.size / (1024 * 1024)).toFixed(2)} MiB Ã‚Â· Formato verificado</p></div></div>
                <div className="flex gap-2"><Button type="button" variant="outline" disabled={loading} onClick={() => inputRef.current?.click()} className="h-9 rounded-md">Sustituir</Button><Button type="button" variant="ghost" disabled={loading} aria-label="Quitar archivo" onClick={() => { setFile(null); setError(""); }} className="h-9 w-9 rounded-md px-0"><X className="size-4" /></Button></div>
              </div>}
              {error && <p role="alert" className="mt-4 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"><AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />{error}</p>}
              <div className="mt-6 flex flex-col-reverse justify-between gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center"><p className="text-xs text-slate-500">El contenido se envÃƒÂ­a al servicio institucional para su anÃƒÂ¡lisis.</p><Button type="button" disabled={!file || loading} onClick={extract} className="h-10 rounded-md bg-[#a82732] px-4 text-white hover:bg-[#8e202a]">{loading ? <><LoaderCircle className="size-4 animate-spin" /> Extrayendo informaciÃƒÂ³nÃ¢â‚¬Â¦</> : "Iniciar extracciÃƒÂ³n"}</Button></div>
            </CardContent>
          </Card>
        </>}

        {stage === "review" && <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-xl font-semibold">RevisiÃƒÂ³n de datos</h2><p className="mt-1 text-sm text-slate-600">Verifica y corrige la informaciÃƒÂ³n antes de tomar una decisiÃƒÂ³n.</p></div><span className={`w-fit rounded-full px-3 py-1 text-xs font-medium ${missingCount ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-800"}`}>{missingCount ? `${missingCount} campo${missingCount === 1 ? "" : "s"} sin informaciÃƒÂ³n` : "Todos los campos tienen informaciÃƒÂ³n"}</span></div>
          {file && <p className="flex items-center gap-2 text-xs text-slate-500"><FileText className="size-4" />{file.name}</p>}
          <Card className="rounded-xl border-0 py-0 shadow-sm ring-1 ring-slate-200/80"><CardHeader className="border-b border-slate-100 px-5 py-4"><CardTitle className="text-base font-semibold">InformaciÃƒÂ³n extraÃƒÂ­da</CardTitle></CardHeader><CardContent className="p-5 sm:p-6">
            <div className="grid gap-4 sm:grid-cols-2">{fields.map(({ key, label, type }) => <div key={key}><label htmlFor={key} className="mb-1.5 block text-sm font-medium text-slate-700">{label}{!fieldsValue[key].trim() && <span className="ml-2 text-xs font-normal text-amber-700">Sin informaciÃƒÂ³n</span>}</label><input id={key} type={type || "text"} value={fieldsValue[key]} onChange={(event) => setFieldsValue((previous) => ({ ...previous, [key]: event.target.value }))} placeholder="No identificado" className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-red-700 focus:ring-2 focus:ring-red-700/15" /></div>)}
              <div className="sm:col-span-2"><label htmlFor="observaciones" className="mb-1.5 block text-sm font-medium text-slate-700">Observaciones {!fieldsValue.observaciones.trim() && <span className="ml-2 text-xs font-normal text-amber-700">Sin informaciÃƒÂ³n</span>}</label><textarea id="observaciones" rows={3} value={fieldsValue.observaciones} onChange={(event) => setFieldsValue((previous) => ({ ...previous, observaciones: event.target.value }))} placeholder="AÃƒÂ±ade o corrige observaciones" className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-red-700 focus:ring-2 focus:ring-red-700/15" /></div>
            </div>
          </CardContent></Card>
          {error && <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between"><Button type="button" variant="outline" onClick={() => setStage("upload")} className="h-10 rounded-md">Volver al documento</Button><div className="flex flex-col gap-2 sm:flex-row"><Button type="button" variant="outline" onClick={() => setStage("reject")} className="h-10 rounded-md border-red-200 text-red-800 hover:bg-red-50">Rechazar nombramiento</Button><Button type="button" onClick={() => setStage("admit")} className="h-10 rounded-md bg-[#a82732] px-4 text-white hover:bg-[#8e202a]">Admitir nombramiento</Button></div></div>
        </>}

        {/* Estas etapas solo simulan la decisiÃƒÂ³n; no crean un registro persistente. */}
        {(stage === "admit" || stage === "reject") && <Card className="mx-auto max-w-2xl rounded-xl border-0 py-0 shadow-sm ring-1 ring-slate-200/80"><CardHeader className="border-b border-slate-100 px-5 py-5"><CardTitle className="text-lg">{stage === "admit" ? "Confirmar admisiÃƒÂ³n" : "Confirmar rechazo"}</CardTitle><p className="text-sm text-slate-600">{stage === "admit" ? "Se generarÃƒÂ¡ una confirmaciÃƒÂ³n de guardado simulado en esta sesiÃƒÂ³n. Esta acciÃƒÂ³n no valida la autenticidad ni la validez jurÃƒÂ­dica del documento." : "El registro serÃƒÂ¡ rechazado en este flujo. No se guardarÃƒÂ¡ informaciÃƒÂ³n."}</p></CardHeader><CardContent className="flex flex-col-reverse justify-end gap-2 p-5 sm:flex-row"><Button type="button" variant="outline" onClick={() => setStage("review")} className="h-10 rounded-md">Cancelar</Button><Button type="button" onClick={async () => {
                if (saving) return;
                if (stage !== "admit") {
                  setDecision("rejected");
                  setStage("done");
                  return;
                }

                setSaving(true);
                setError("");

                try {
                  const recordId = await persistNombramientoToPocketBase();
                  setDecision("admitted");
                  setOperationId(recordId);
                  setStage("done");
                  scheduleRedirectToList();
                } catch (cause) {
                  setError(
                    cause instanceof TypeError
                      ? "No se pudo conectar con el servicio. Revisa tu conexiÃ³n e intÃ©ntalo de nuevo."
                      : cause instanceof Error
                        ? cause.message
                        : "OcurriÃ³ un error al guardar el nombramiento.",
                  );
                } finally {
                  setSaving(false);
                }
              }} className={`h-10 rounded-md px-4 text-white ${stage === "admit" ? "bg-[#a82732] hover:bg-[#8e202a]" : "bg-slate-700 hover:bg-slate-800"}`}>{stage === "admit" ? "Confirmar admisiÃƒÂ³n" : "SÃƒÂ­, rechazar"}</Button></CardContent></Card>}

        {stage === "done" && <Card className="mx-auto max-w-3xl rounded-xl border-0 py-0 shadow-sm ring-1 ring-slate-200/80"><CardHeader className="items-center border-b border-slate-100 px-5 py-7 text-center"><span className={`mb-2 flex size-12 items-center justify-center rounded-full ${decision === "admitted" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-700"}`}>{decision === "admitted" ? <CheckCircle2 className="size-6" /> : <X className="size-6" />}</span><CardTitle className="text-xl">{decision === "admitted" ? "AdmisiÃƒÂ³n confirmada" : "Nombramiento rechazado"}</CardTitle><p className="max-w-xl text-sm text-slate-600">{decision === "admitted" ? <>Guardado simulado. El registro no se almacenÃƒÂ³ permanentemente y existe solo en el estado de esta pantalla. Identificador de operaciÃƒÂ³n: <strong>{operationId}</strong>.</> : "El flujo se marcÃƒÂ³ como rechazado. No se guardaron datos."}</p></CardHeader><CardContent className="p-5 sm:p-6"><h3 className="mb-3 font-semibold">{decision === "admitted" ? "Resumen de los datos aceptados" : "Resumen revisado"}</h3><dl className="grid gap-3 sm:grid-cols-2">{acceptedEntries.map(([label, value]) => <div key={label} className="rounded-md bg-slate-50 p-3"><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 break-words text-sm font-medium text-slate-800">{value}</dd></div>)}<div className="rounded-md bg-slate-50 p-3 sm:col-span-2"><dt className="text-xs text-slate-500">Observaciones</dt><dd className="mt-1 whitespace-pre-wrap text-sm font-medium text-slate-800">{fieldsValue.observaciones || "No identificado"}</dd></div></dl><div className="mt-5 flex flex-col-reverse justify-end gap-2 border-t border-slate-100 pt-5 sm:flex-row"><Button type="button" variant="outline" onClick={onClose} className="h-10 rounded-md">Volver al panel</Button><Button type="button" onClick={startNew} className="h-10 rounded-md bg-[#a82732] px-4 text-white hover:bg-[#8e202a]"><RotateCcw className="size-4" /> Nueva captura</Button></div></CardContent></Card>}
      </main>
    </section>
  );
}
