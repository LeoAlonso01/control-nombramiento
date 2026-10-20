import "server-only";

import { NextResponse } from "next/server";
import { cookieSerialize } from "pocketbase";
import {
  POCKETBASE_AUTH_COOKIE_NAME,
} from "@/lib/pocketbase/server";

export type OriginValidation =
  | { allowed: true }
  | { allowed: false; reason: "forbidden" | "misconfigured" };

/** Evita que respuestas con sesión o datos de usuario queden almacenadas en caché. */
export function noStoreJson(body: unknown, status = 200): NextResponse {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

/** Normaliza solo valores que representen un origen, no una URL con ruta o credenciales. */
function parseOrigin(value: string): string | null {
  try {
    const url = new URL(value);

    if (
      (url.protocol !== "http:" && url.protocol !== "https:") ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    ) {
      return null;
    }

    return url.origin;
  } catch {
    return null;
  }
}

/** Mitiga solicitudes cross-origin en operaciones POST basadas en cookies. */
export function validatePostOrigin(request: Request): OriginValidation {
  const requestOrigin = request.headers.get("origin");

  if (!requestOrigin || requestOrigin === "null") {
    return { allowed: false, reason: "forbidden" };
  }

  const normalizedRequestOrigin = parseOrigin(requestOrigin);

  if (!normalizedRequestOrigin || normalizedRequestOrigin !== requestOrigin) {
    return { allowed: false, reason: "forbidden" };
  }

  const configuredOrigin = process.env.APP_ORIGIN?.trim();

  if (configuredOrigin) {
    const normalizedConfiguredOrigin = parseOrigin(configuredOrigin);

    if (!normalizedConfiguredOrigin) {
      return { allowed: false, reason: "misconfigured" };
    }

    return normalizedRequestOrigin === normalizedConfiguredOrigin
      ? { allowed: true }
      : { allowed: false, reason: "forbidden" };
  }

  if (process.env.NODE_ENV === "production") {
    return { allowed: false, reason: "misconfigured" };
  }

  // En desarrollo sin APP_ORIGIN, limita la solicitud al origen de la propia petición.
  return normalizedRequestOrigin === new URL(request.url).origin
    ? { allowed: true }
    : { allowed: false, reason: "forbidden" };
}

export type LimitedJsonBody =
  | { ok: true; value: unknown }
  | { ok: false; status: 400 | 413 | 415; message: string };

/** Lee JSON con límite de bytes y rechaza MIME, tamaño, UTF-8 o sintaxis inválidos. */
export async function readLimitedJsonBody(
  request: Request,
  maximumBytes = 8 * 1024,
): Promise<LimitedJsonBody> {
  const contentType = request.headers
    .get("content-type")
    ?.split(";", 1)[0]
    .trim()
    .toLowerCase();

  if (contentType !== "application/json") {
    return {
      ok: false,
      status: 415,
      message: "El contenido debe ser JSON.",
    };
  }

  const contentLength = request.headers.get("content-length");

  if (contentLength !== null) {
    if (!/^\d+$/.test(contentLength)) {
      return { ok: false, status: 400, message: "La solicitud no es válida." };
    }

    if (Number(contentLength) > maximumBytes) {
      return {
        ok: false,
        status: 413,
        message: "El cuerpo de la solicitud es demasiado grande.",
      };
    }
  }

  if (!request.body) {
    return { ok: false, status: 400, message: "La solicitud no es válida." };
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    // Se cuenta el cuerpo leído, además de revisar Content-Length, porque ese encabezado
    // puede faltar o no reflejar el tamaño real transmitido.
    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      totalBytes += value.byteLength;

      if (totalBytes > maximumBytes) {
        await reader.cancel();
        return {
          ok: false,
          status: 413,
          message: "El cuerpo de la solicitud es demasiado grande.",
        };
      }

      chunks.push(value);
    }
  } catch {
    return { ok: false, status: 400, message: "La solicitud no es válida." };
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;

  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false, status: 400, message: "El JSON no es válido." };
  }
}

export function clearPocketBaseAuthCookie(): string {
  return cookieSerialize(POCKETBASE_AUTH_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "Lax",
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  });
}
