import { ClientResponseError } from "pocketbase";
import {
  getVerifiedSessionContext,
  SessionVerificationError,
} from "@/lib/auth/server";
import { hasPermission } from "@/lib/auth/authorization";
import { noStoreJson } from "@/lib/auth/http";
import {
  listDeclaraciones,
  DeclaracionQueryError,
  parseDeclaracionQuery,
} from "@/lib/records/declaraciones";
import { isDeclarationType, isValidIsoDate } from "@/lib/records/contracts";
import {
  hasMatchingDocumentSignature,
  validateDocumentMetadata,
} from "@/lib/files/document-validation";
import { projectDeclaracion } from "@/lib/records/projections";
import {
  exportPocketBaseAuthCookie,
  PocketBaseConfigurationError,
} from "@/lib/pocketbase/server";

/**
 * Lista paginada de declaraciones usando la sesión verificada.
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
    if (!role || !hasPermission(role, "declaraciones", "read")) {
      return noStoreJson(
        { error: "No tienes permiso para consultar declaraciones." },
        403,
      );
    }

    const url = new URL(request.url);
    const query = parseDeclaracionQuery(url.searchParams);
    const result = await listDeclaraciones(context.pocketBase, query, role);

    const response = noStoreJson(result);
    response.headers.append(
      "Set-Cookie",
      exportPocketBaseAuthCookie(context.pocketBase),
    );
    return response;
  } catch (error) {
    if (error instanceof DeclaracionQueryError) {
      return noStoreJson(
        { error: "Los parámetros de consulta no son válidos." },
        400,
      );
    }

    if (error instanceof PocketBaseConfigurationError) {
      return noStoreJson(
        { error: "La autenticación no está configurada." },
        500,
      );
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

type CreatedDeclaracionResponse = {
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
 * Crea una declaración desde el frontend.
 * - Valida la sesión con cookies HTTP-only.
 * - Aplica autorización de app por rol.
 * - Valida campos y firma binaria del documento.
 */
export async function POST(request: Request) {
  try {
    const context = await getVerifiedSessionContext(
      request.headers.get("cookie"),
    );

    if (!context.authenticated) {
      return noStoreJson({ error: "Se requiere una sesión activa." }, 401);
    }

    const role = context.session.user.role;
    if (!role || !hasPermission(role, "declaraciones", "create")) {
      return noStoreJson(
        { error: "No tienes permiso para registrar declaraciones." },
        403,
      );
    }

    const form = await request.formData();

    const nombre_declarante = normalizeText(
      readText(form, "nombre_declarante"),
      200,
    );
    const curp_declarante = normalizeText(readText(form, "curp_declarante"), 40);
    const lugar_declaracion = normalizeText(
      readText(form, "lugar_declaracion"),
      160,
    );

    const fecha = readOptionalIsoDate(form, "fecha");
    const fecha_recepcion = readOptionalIsoDate(form, "fecha_recepcion");

    const periodo_correspondiente = normalizeText(
      readText(form, "periodo_correspondiente"),
      40,
    );
    const observaciones = normalizeText(
      readText(form, "observaciones"),
      10_000,
    );
    const datos_ocr = parseJsonField(readText(form, "datos_ocr"));

    const tipo_declaracion = readText(form, "tipo_declaracion");
    if (tipo_declaracion && !isDeclarationType(tipo_declaracion)) {
      throw new TypeError("invalid_form_data");
    }

    const documento = readFile(form, "documento");
    if (documento) {
      if (documento.size > MAX_POCKETBASE_DOCUMENT_SIZE) {
        return noStoreJson(
          {
            error:
              "El archivo supera el límite de 5 MiB configurado en PocketBase.",
          },
          400,
        );
      }

      const issue = validateDocumentMetadata(
        documento.size,
        documento.type,
        "declaracion",
        documento.name,
      );

      if (issue) {
        const messages: Record<string, string> = {
          empty: "El archivo está vacío.",
          too_large: "El archivo supera el límite permitido.",
          unsupported_type: "Formato no admitido.",
          unsupported_extension:
            "La extensión del archivo no coincide con su contenido.",
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
          {
            error:
              "El contenido del archivo no coincide con un PDF/imagen válida.",
          },
          400,
        );
      }
    }

    const payload: Record<string, unknown> = {
      ...(nombre_declarante ? { nombre_declarante } : {}),
      ...(curp_declarante ? { curp_declarante } : {}),
      ...(lugar_declaracion ? { lugar_declaracion } : {}),
      ...(fecha ? { fecha } : {}),
      ...(tipo_declaracion ? { tipo_declaracion } : {}),
      ...(fecha_recepcion ? { fecha_recepcion } : {}),
      ...(periodo_correspondiente ? { periodo_correspondiente } : {}),
      ...(observaciones ? { observaciones } : {}),
      ...(datos_ocr ? { datos_ocr } : {}),
      estado_proceso: "pendiente",
      ...(documento ? { documento } : {}),
    };

    const record = await context.pocketBase
      .collection("declaraciones")
      .create<Record<string, unknown>>(payload);

    const responsePayload: CreatedDeclaracionResponse = {
      id: typeof record.id === "string" ? record.id : String(record.id ?? ""),
    };

    const response = noStoreJson({
      ...responsePayload,
      record: projectDeclaracion(role, record),
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
          { error: "No se encontró la colección de declaraciones." },
          404,
        );
      }
    }

    if (error instanceof PocketBaseConfigurationError) {
      return noStoreJson(
        { error: "La autenticación no está configurada." },
        500,
      );
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
