type SessionState = { authenticated: boolean };

export type DashboardAccess = "allowed" | "unauthenticated" | "unavailable";

/** Converts session verification into a fail-closed dashboard decision. */
export async function resolveDashboardAccess(
  readSession: () => Promise<SessionState>,
): Promise<DashboardAccess> {
  try {
    const session = await readSession();
    return session.authenticated ? "allowed" : "unauthenticated";
  } catch {
    return "unavailable";
  }
}
