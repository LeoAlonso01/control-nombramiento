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

/** Verifies a request cookie and retains its refreshed client for server handlers. */
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

  // This is only a local expiry check. A usable token is still verified by PocketBase.
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

    // Do not expose or log PocketBase's response, URL, token, or request data.
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

  // Resolve authorization only from the record returned by authenticated authRefresh,
  // after identity and active status have been verified above.
  const configuredAdminId = process.env.APP_ADMIN_USER_ID;
  const role = resolveAppRole(record.id, configuredAdminId, record.rol);

  // Keep only fields required to identify the auth record in the SDK cookie.
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

/** Verifies a request cookie and returns only safe session data. */
export async function getServerSession(
  cookieHeader?: string | null,
): Promise<SessionResult> {
  const context = await getVerifiedSessionContext(cookieHeader);

  return context.authenticated
    ? context.session
    : { authenticated: false };
}

/** Checks the only permission granted in this phase: explicit app administration. */
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
