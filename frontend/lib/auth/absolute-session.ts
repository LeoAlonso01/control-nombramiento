import { createHmac, timingSafeEqual } from "node:crypto";
import { cookieParse, cookieSerialize } from "pocketbase";

export const ABSOLUTE_SESSION_COOKIE_NAME = "app_session";
export const ABSOLUTE_SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000;

/** Datos firmados que vinculan la sesión absoluta con un usuario y un plazo fijo. */
export type AbsoluteSessionDeadline = {
  userId: string;
  issuedAt: number;
  expiresAt: number;
  value: string;
};

export class SessionSigningConfigurationError extends Error {
  constructor() {
    super("Session signing configuration is missing or invalid.");
    this.name = "SessionSigningConfigurationError";
  }
}

function signingSecret(): string {
  const secret = process.env.SESSION_SIGNING_SECRET;

  if (!secret || Buffer.byteLength(secret, "utf8") < 32) {
    throw new SessionSigningConfigurationError();
  }

  return secret;
}

/** Falla de forma explícita si el secreto no cumple la longitud mínima configurada. */
export function assertSessionSigningConfigured(): void {
  signingSecret();
}

/** Calcula HMAC-SHA256 para detectar alteraciones del contenido firmado. */
function signature(payload: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(payload).digest();
}

/** Codifica los datos para transporte; Base64URL no cifra su contenido. */
function encodePayload(payload: { userId: string; issuedAt: number; expiresAt: number }): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

/** Adjunta la firma al payload codificado para formar el valor de la cookie. */
function signPayload(payload: string, secret: string): string {
  return `${payload}.${signature(payload, secret).toString("base64url")}`;
}

/** Verifica firma, tipos e intervalo temporal fijo antes de aceptar los datos. */
function parseSignedValue(value: string, now: number): AbsoluteSessionDeadline | null {
  const [encodedPayload, encodedSignature, extra] = value.split(".");

  if (!encodedPayload || !encodedSignature || extra !== undefined) return null;

  const secret = signingSecret();
  let expectedSignature: Buffer;
  let suppliedSignature: Buffer;
  let decoded: unknown;

  try {
    expectedSignature = signature(encodedPayload, secret);
    suppliedSignature = Buffer.from(encodedSignature, "base64url");
    decoded = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  if (
    suppliedSignature.length !== expectedSignature.length ||
    // La longitud se compara antes para que timingSafeEqual reciba buffers compatibles.
    !timingSafeEqual(suppliedSignature, expectedSignature) ||
    typeof decoded !== "object" || decoded === null || Array.isArray(decoded)
  ) {
    return null;
  }

  const payload = decoded as Record<string, unknown>;
  const issuedAt = payload.issuedAt;
  const expiresAt = payload.expiresAt;

  if (
    typeof payload.userId !== "string" ||
    payload.userId.length === 0 ||
    typeof issuedAt !== "number" ||
    typeof expiresAt !== "number" ||
    !Number.isSafeInteger(issuedAt) ||
    !Number.isSafeInteger(expiresAt) ||
    expiresAt !== issuedAt + ABSOLUTE_SESSION_MAX_AGE_MS ||
    issuedAt > now ||
    expiresAt <= now
  ) {
    return null;
  }

  return {
    userId: payload.userId,
    issuedAt,
    expiresAt,
    value,
  };
}

/** Crea el vencimiento absoluto firmado; las renovaciones no extienden este plazo. */
export function createAbsoluteSessionDeadline(
  userId: string,
  now = Date.now(),
): AbsoluteSessionDeadline {
  if (!userId || !Number.isSafeInteger(now)) {
    throw new TypeError("Invalid absolute session input.");
  }

  const expiresAt = now + ABSOLUTE_SESSION_MAX_AGE_MS;
  const encodedPayload = encodePayload({ userId, issuedAt: now, expiresAt });
  const value = signPayload(encodedPayload, signingSecret());

  return { userId, issuedAt: now, expiresAt, value };
}

/** Lee y valida la cookie firmada; su contenido no sustituye la verificación ante PocketBase. */
export function readAbsoluteSessionDeadline(
  cookieHeader: string | null | undefined,
  now = Date.now(),
): AbsoluteSessionDeadline | null {
  if (!cookieHeader) return null;

  const value = cookieParse(cookieHeader)[ABSOLUTE_SESSION_COOKIE_NAME];
  return typeof value === "string" ? parseSignedValue(value, now) : null;
}

/** Serializa la fecha límite como cookie inaccesible desde JavaScript del navegador. */
export function serializeAbsoluteSessionCookie(
  deadline: AbsoluteSessionDeadline,
): string {
  return cookieSerialize(ABSOLUTE_SESSION_COOKIE_NAME, deadline.value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "Lax",
    path: "/",
    expires: new Date(deadline.expiresAt),
  });
}

/** Invalida la cookie absoluta al cerrar sesión o rechazar la sesión. */
export function clearAbsoluteSessionCookie(): string {
  return cookieSerialize(ABSOLUTE_SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "Lax",
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  });
}
