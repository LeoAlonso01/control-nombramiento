import "server-only";

import PocketBase, { getTokenPayload, type RecordModel } from "pocketbase";
import { parsePocketBaseUrl } from "@/lib/pocketbase/url";

export const POCKETBASE_AUTH_COOKIE_NAME = "pb_auth";

export class PocketBaseConfigurationError extends Error {
  constructor() {
    super("PocketBase server configuration is missing or invalid.");
    this.name = "PocketBaseConfigurationError";
  }
}

/**
 * Creates an isolated PocketBase client for one server request.
 * `cookieHeader` is the incoming request's complete Cookie header, if present.
 */
export function createPocketBaseServer(
  cookieHeader?: string | null,
): PocketBase {
  const configuredUrl = process.env.POCKETBASE_URL?.trim();

  if (!configuredUrl) {
    throw new PocketBaseConfigurationError();
  }

  const baseUrl = parsePocketBaseUrl(configuredUrl);

  if (!baseUrl) {
    throw new PocketBaseConfigurationError();
  }

  const pb = new PocketBase(baseUrl.toString());

  if (cookieHeader) {
    pb.authStore.loadFromCookie(cookieHeader, POCKETBASE_AUTH_COOKIE_NAME);
  }

  return pb;
}

/** Exports the current SDK auth state as a secure server-set cookie header. */
export function exportPocketBaseAuthCookie(
  pb: PocketBase,
  absoluteExpiresAt?: number,
): string {
  const record = pb.authStore.record as RecordModel | null;

  if (record?.collectionName === "users") {
    pb.authStore.save(pb.authStore.token, {
      id: record.id,
      collectionId: record.collectionId,
      collectionName: record.collectionName,
      activo: record["activo"],
    });
  }

  const tokenExpirySeconds = getTokenPayload(pb.authStore.token).exp;
  const tokenExpiresAt =
    typeof tokenExpirySeconds === "number" ? tokenExpirySeconds * 1000 : undefined;
  const expiresAt = [absoluteExpiresAt, tokenExpiresAt]
    .filter((value): value is number => typeof value === "number")
    .reduce((earliest, value) => Math.min(earliest, value), Number.POSITIVE_INFINITY);

  return pb.authStore.exportToCookie(
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Lax",
      path: "/",
      ...(Number.isFinite(expiresAt) ? { expires: new Date(expiresAt) } : {}),
    },
    POCKETBASE_AUTH_COOKIE_NAME,
  );
}
