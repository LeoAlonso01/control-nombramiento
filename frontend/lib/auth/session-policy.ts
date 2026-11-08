export type SessionPolicyRecord = {
  id: string;
  collectionName?: string;
};

export type SessionPolicyResult = "authenticated" | "invalid";

/** Acepta la sesión solo si el token, la colección y el ID del registro coinciden. */
export function classifySessionState(
  tokenValid: boolean,
  record: SessionPolicyRecord | null,
  expectedUserId: string,
): SessionPolicyResult {
  if (!tokenValid || !record || record.collectionName !== "users") {
    return "invalid";
  }

  if (!expectedUserId || record.id !== expectedUserId) return "invalid";
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
