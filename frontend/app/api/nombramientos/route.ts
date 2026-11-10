import { ClientResponseError } from "pocketbase";
import {
  getVerifiedSessionContext,
  SessionVerificationError,
} from "@/lib/auth/server";
import { hasPermission } from "@/lib/auth/authorization";
import { noStoreJson } from "@/lib/auth/http";
import {
  listNombramientos,
  NombramientoQueryError,
  parseNombramientoQuery,
} from "@/lib/records/nombramientos";
import {
  exportPocketBaseAuthCookie,
  PocketBaseConfigurationError,
} from "@/lib/pocketbase/server";
import { hasMatchingDocumentSignature, validateDocumentMetadata } from "@/lib/files/document-validation";
import { isValidIsoDate } from "@/lib/records/contracts";
import { projectNombramiento } from "@/lib/records/projections";

/**
 * Lista paginada de nombramientos usando la sesión verificada.
 * La respuesta siempre es una proyección allowlist, no el registro PocketBase.
 */
export async function GET(request: Request) {
  try {
    const context = await getVerifiedSessionContext(
      request.headers.get("cookie"),
    );

    if (!context.authenticated) {
      return noStoreJson({ error: "Se requiere una sesión activa." }, 401);
    }

    const role = context.session.user.role;
    if (!role || !hasPermission(role, "nombramientos", "read")) {
      return noStoreJson(
        { error: "No tienes permiso para consultar nombramientos." },
        403,
      );
    }

    const url = new URL(request.url);
    const query = parseNombramientoQuery(url.searchParams);
    const result = await listNombramientos(context.pocketBase, query, role);

    const response = noStoreJson(result);
    response.headers.append(
      "Set-Cookie",
      exportPocketBaseAuthCookie(context.pocketBase),
    );
    return response;
  } catch (error) {
    if (error instanceof NombramientoQueryError) {
      return noStoreJson({ error: "Los parámetros de consulta no son válidos." }, 400);
    }

    if (error instanceof PocketBaseConfigurationError) {
      return noStoreJson({ error: "La autenticación no está configurada." }, 500);
    }

    if (error instanceof SessionVerificationError) {
      return noStoreJson(
        { error: "El servicio de autenticación no está disponible." },
        503,
      );
    }

    // No se registran errores externos ni contenido de registros/documentos.
    return noStoreJson({ error: "No fue posible verificar la sesión." }, 503);
  }
}

type CreatedNombramientoResponse = {
  id: string;
};

const MAX_POCKETBASE_DOCUMENT_SIZE = 5 * 1024 * 1024;

function readText(form: FormData, key: string): string | null {
  const value = form.get(key);
  if (value === null) return null;
  if (typeof value !== "string") throw new TypeError("invalid_form_data");
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function readOptionalIsoDate(form: FormData, key: string): string | null {
  const value = readText(form, key);
  if (value && !isValidIsoDate(value)) throw new TypeError("invalid_form_data");
  return value;
}

function normalizeText(value: string | null, max: number): string | null {
  if (value === null) return null;
  if (value.length > max) throw new TypeError("invalid_form_data");
  return value;
}

function readFile(form: FormData, key: string): File | null {
  const value = form.get(key);
  if (value === null) return null;
  if (typeof value === "string") throw new TypeError("invalid_form_data");
  if (typeof File !== "undefined" && value instanceof File) return value;
  return null;
}

function parseJsonField(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  if (raw.length > 1_900_000) throw new TypeError("invalid_form_data");

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new TypeError("invalid_form_data");
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new TypeError("invalid_form_data");
  }

  return parsed as Record<string, unknown>;
}

/**
 * Crea un registro de nombramiento desde el frontend.
 * - Valida la sesión con cookies HTTP-only.
 * - Aplica autorización de app por rol.
 * - Valida campos y firma binaria del documento.
 */
export async function POST(request: Request) {
  try {
    const context = await getVerifiedSessionContext(request.headers.get("cookie"));

    if (!context.authenticated) {
      return noStoreJson({ error: "Se requiere una sesión activa." }, 401);
    }

    const role = context.session.user.role;
    if (!role || !hasPermission(role, "nombramientos", "create")) {
      return noStoreJson({ error: "No tienes permiso para registrar nombramientos." }, 403);
    }

    const form = await request.formData();

    const numero_nombramiento = normalizeText(readText(form, "numero_nombramiento"), 120);
    const nombre_funcionario = normalizeText(readText(form, "nombre_funcionario"), 200);
    const cargo = normalizeText(readText(form, "cargo"), 200);

    // Mapeo UI -> PocketBase:
    // - fecha_recepcion (UI) -> fecha_recepcion (PB); no usar emisión como recepción.
    // - fecha_inicio (UI) -> fecha_nombramiento (PB)
    const fecha_recepcion = readOptionalIsoDate(form, "fecha_recepcion");
    const fecha_nombramiento = readOptionalIsoDate(form, "fecha_nombramiento");

    const observaciones = normalizeText(readText(form, "observaciones"), 10_000);
    const datos_ocr = parseJsonField(readText(form, "datos_ocr"));

    const documento = readFile(form, "documento");

    if (documento) {
      if (documento.size > MAX_POCKETBASE_DOCUMENT_SIZE) {
        return noStoreJson(
          { error: "El archivo supera el límite de 5 MiB configurado en PocketBase." },
          400,
        );
      }

      const issue = validateDocumentMetadata(
        documento.size,
        documento.type,
        "nombramiento",
        documento.name,
      );

      if (issue) {
        const messages: Record<string, string> = {
          empty: "El archivo está vacío.",
          too_large: "El archivo supera el límite permitido.",
          unsupported_type: "Formato no admitido.",
          unsupported_extension: "La extensión del archivo no coincide con su contenido.",
        };

        return noStoreJson(
          { error: messages[issue] ?? "El archivo no es válido." },
          400,
        );
      }

      const signature = new Uint8Array(
        await documento.slice(0, 12).arrayBuffer(),
      );

      if (!hasMatchingDocumentSignature(documento.type, signature)) {
        return noStoreJson(
          { error: "El contenido del archivo no coincide con un PDF/imagen válida." },
          400,
        );
      }
    }

    const payload: Record<string, unknown> = {
      ...(numero_nombramiento ? { numero_nombramiento } : {}),
      ...(nombre_funcionario ? { nombre_funcionario } : {}),
      ...(cargo ? { cargo } : {}),
      ...(fecha_recepcion ? { fecha_recepcion } : {}),
      ...(fecha_nombramiento ? { fecha_nombramiento } : {}),
      ...(observaciones ? { observaciones } : {}),
      ...(datos_ocr ? { datos_ocr } : {}),
      estado_proceso: "pendiente",
      estado_ocr: "revision_manual",
      ...(documento ? { documento } : {}),
    };

    const record = await context.pocketBase
      .collection("nombramientos")
      .create<Record<string, unknown>>(payload);

    const responsePayload: CreatedNombramientoResponse = {
      id: typeof record.id === "string" ? record.id : String(record.id ?? ""),
    };

    const response = noStoreJson({
      ...responsePayload,
      record: projectNombramiento(role, record),
    });

    response.headers.append(
      "Set-Cookie",
      exportPocketBaseAuthCookie(context.pocketBase),
    );
    return response;
  } catch (error) {
    if (error instanceof TypeError && error.message === "invalid_form_data") {
      return noStoreJson(
        { error: "Los datos de captura no tienen el formato esperado." },
        400,
      );
    }

    if (error instanceof ClientResponseError) {
      if (error.status === 400) {
        return noStoreJson(
          { error: "PocketBase rechazó los datos enviados." },
          400,
        );
      }
      if (error.status === 403) {
        return noStoreJson(
          { error: "PocketBase denegó la creación del registro." },
          403,
        );
      }
      if (error.status === 404) {
        return noStoreJson(
          { error: "No se encontró la colección de nombramientos." },
          404,
        );
      }
    }

    if (error instanceof PocketBaseConfigurationError) {
      return noStoreJson({ error: "La autenticación no está configurada." }, 500);
    }

    if (error instanceof SessionVerificationError) {
      return noStoreJson(
        { error: "El servicio de autenticación no está disponible." },
        503,
      );
    }

    return noStoreJson({ error: "No fue posible verificar la sesión." }, 503);
  }
}
