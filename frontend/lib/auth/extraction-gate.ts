import type { VerifiedSessionContext } from "./server";

export type ProtectedActionResult<TContext, TResponse> =
  | { kind: "unauthenticated"; response: TResponse }
  | { kind: "forbidden"; response: TResponse }
  | { kind: "unavailable"; response: TResponse }
  | { kind: "authenticated"; context: TContext; response: TResponse };

type SessionAuthorizationContext = Extract<VerifiedSessionContext, { authenticated: true }>;

/** Runs protected work only after the supplied server session is verified. */
export async function runAfterSessionVerification<
  TContext extends { authenticated: boolean },
  TResponse,
>(
  verify: () => Promise<TContext>,
  unauthenticatedResponse: () => TResponse,
  unavailableResponse: () => TResponse,
  action: (context: Extract<TContext, { authenticated: true }>) => Promise<TResponse>,
): Promise<ProtectedActionResult<Extract<TContext, { authenticated: true }>, TResponse>> {
  let context: TContext;

  try {
    context = await verify();
  } catch {
    return { kind: "unavailable", response: unavailableResponse() };
  }

  if (!context.authenticated) {
    return { kind: "unauthenticated", response: unauthenticatedResponse() };
  }

  const authenticatedContext = context as Extract<TContext, { authenticated: true }>;
  const response = await action(authenticatedContext);

  return { kind: "authenticated", context: authenticatedContext, response };
}

/** Verifies session and role permission before running protected work. */
export async function runAfterSessionPermission<TResponse>(
  verify: () => Promise<VerifiedSessionContext>,
  unauthenticatedResponse: () => TResponse,
  unavailableResponse: () => TResponse,
  forbiddenResponse: () => TResponse,
  isAuthorized: (context: SessionAuthorizationContext) => boolean,
  action: (context: SessionAuthorizationContext) => Promise<TResponse>,
): Promise<ProtectedActionResult<SessionAuthorizationContext, TResponse>> {
  let context: VerifiedSessionContext;

  try {
    context = await verify();
  } catch {
    return { kind: "unavailable", response: unavailableResponse() };
  }

  if (!context.authenticated) {
    return { kind: "unauthenticated", response: unauthenticatedResponse() };
  }

  if (!isAuthorized(context)) {
    return { kind: "forbidden", response: forbiddenResponse() };
  }

  const response = await action(context);
  return { kind: "authenticated", context, response };
}
