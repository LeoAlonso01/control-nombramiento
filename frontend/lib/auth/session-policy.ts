export type SessionPolicyRecord = {
  id: string;
  collectionName?: string;
  activo?: unknown;
};

export type SessionPolicyResult = "authenticated" | "invalid" | "inactive";

/** Acepta la sesión solo si el token, la colección, el ID y la actividad coinciden. */
export function classifySessionState(
  tokenValid: boolean,
  record: SessionPolicyRecord | null,
  expectedUserId: string,
): SessionPolicyResult {
  if (!tokenValid || !record || record.collectionName !== "users") {
    return "invalid";
  }

  if (record.id !== expectedUserId) return "invalid";
  if (record.activo !== true) return "inactive";
  return "authenticated";
}

/** Distingue credenciales rechazadas de una indisponibilidad temporal del servicio. */
export function classifyRefreshFailure(
  status: number | null,
): "invalid" | "unavailable" {
  return status !== null && [400, 401, 403].includes(status)
    ? "invalid"
    : "unavailable";
}
