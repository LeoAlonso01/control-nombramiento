import "server-only";

import { ClientResponseError, type RecordModel } from "pocketbase";
import type PocketBase from "pocketbase";
import { createPocketBaseServer } from "@/lib/pocketbase/server";
import {
  readAbsoluteSessionDeadline,
  type AbsoluteSessionDeadline,
} from "@/lib/auth/absolute-session";
import {
  classifyRefreshFailure,
  classifySessionState,
} from "@/lib/auth/session-policy";
import { resolveAppRole, type AppRole } from "@/lib/auth/authorization";

type PocketBaseUserRecord = RecordModel & {
  activo?: unknown;
  rol?: unknown;
};

export type AuthenticatedSession = {
  authenticated: true;
  user: {
    id: string;
    isAdmin: boolean;
    role: AppRole | null;
  };
};

export type SessionResult =
  | { authenticated: false }
  | AuthenticatedSession;

export type UnauthenticatedReason = "absent" | "invalid" | "expired" | "inactive";

export type VerifiedSessionContext =
  | { authenticated: false; reason: UnauthenticatedReason }
  | {
      authenticated: true;
      session: AuthenticatedSession;
      pocketBase: PocketBase;
      deadline: AbsoluteSessionDeadline;
    };

export type AppPermission = "app:admin";

export type PermissionResult =
  | { authorized: true; session: AuthenticatedSession }
  | { authorized: false; reason: "unauthenticated" | "forbidden" };

export class SessionVerificationError extends Error {
  constructor() {
    super("The session could not be verified.");
    this.name = "SessionVerificationError";
  }
}

/**
 * Verifica cookies y token contra PocketBase, comprueba identidad y actividad,
 * y resuelve el rol desde el registro renovado. Devuelve el cliente renovado
 * para que el handler pueda emitir las cookies actualizadas.
 */
export async function getVerifiedSessionContext(
  cookieHeader?: string | null,
): Promise<VerifiedSessionContext> {
  if (!cookieHeader?.trim()) {
    return { authenticated: false, reason: "absent" };
  }

  const deadline = readAbsoluteSessionDeadline(cookieHeader);

  if (!deadline) {
    return { authenticated: false, reason: "expired" };
  }

  const pb = createPocketBaseServer(cookieHeader);

  // La validez local evita solicitudes innecesarias, pero no sustituye authRefresh.
  if (!pb.authStore.isValid) {
    pb.authStore.clear();
    return { authenticated: false, reason: "invalid" };
  }

  let record: PocketBaseUserRecord;

  try {
    ({ record } = await pb.collection("users").authRefresh<PocketBaseUserRecord>());
  } catch (error) {
    const failure = classifyRefreshFailure(
      error instanceof ClientResponseError ? error.status : null,
    );

    if (failure === "invalid") {
      pb.authStore.clear();
      return { authenticated: false, reason: "invalid" };
    }

    // No expone ni registra la respuesta de PocketBase, su URL, el token o los datos de petición.
    throw new SessionVerificationError();
  }

  const sessionState = classifySessionState(true, record, deadline.userId);

  if (sessionState !== "authenticated") {
    pb.authStore.clear();
    return {
      authenticated: false,
      reason: sessionState === "inactive" ? "inactive" : "invalid",
    };
  }

  // El rol se toma únicamente del registro renovado, tras validar identidad y activo.
  const configuredAdminId = process.env.APP_ADMIN_USER_ID;
  const role = resolveAppRole(record.id, configuredAdminId, record.rol);

  // No se persiste el rol en la cookie: cada petición vuelve a resolverlo en PocketBase.
  pb.authStore.save(pb.authStore.token, {
    id: record.id,
    collectionId: record.collectionId,
    collectionName: record.collectionName,
    activo: record.activo,
  });

  const session: AuthenticatedSession = {
    authenticated: true,
    user: {
      id: record.id,
      role,
      isAdmin: role === "admin",
    },
  };

  return { authenticated: true, session, pocketBase: pb, deadline };
}

/** Verifica la sesión y expone únicamente los datos de usuario necesarios para la aplicación. */
export async function getServerSession(
  cookieHeader?: string | null,
): Promise<SessionResult> {
  const context = await getVerifiedSessionContext(cookieHeader);

  return context.authenticated
    ? context.session
    : { authenticated: false };
}

/** Conserva el control administrativo específico existente para operaciones app:admin. */
export async function requirePermission(
  permission: AppPermission,
  cookieHeader?: string | null,
): Promise<PermissionResult> {
  const session = await getServerSession(cookieHeader);

  if (!session.authenticated) {
    return { authorized: false, reason: "unauthenticated" };
  }

  if (permission !== "app:admin" || !session.user.isAdmin) {
    return { authorized: false, reason: "forbidden" };
  }

  return { authorized: true, session };
}
