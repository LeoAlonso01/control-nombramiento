export type ProtectedActionResult<TContext, TResponse> =
  | { kind: "unauthenticated"; response: TResponse }
  | { kind: "unavailable"; response: TResponse }
  | { kind: "authenticated"; context: TContext; response: TResponse };

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
