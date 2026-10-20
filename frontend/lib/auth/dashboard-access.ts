type SessionState = { authenticated: boolean };

export type DashboardAccess = "allowed" | "unauthenticated" | "unavailable";

/** Convierte el resultado de verificar sesión en una decisión de acceso al dashboard. */
export async function resolveDashboardAccess(
  readSession: () => Promise<SessionState>,
): Promise<DashboardAccess> {
  try {
    const session = await readSession();
    return session.authenticated ? "allowed" : "unauthenticated";
  } catch {
    // Una indisponibilidad de autenticación no equivale a una sesión válida.
    return "unavailable";
  }
}
