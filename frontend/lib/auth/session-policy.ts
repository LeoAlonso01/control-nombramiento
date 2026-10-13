export type SessionPolicyRecord = {
  id: string;
  collectionName?: string;
  activo?: unknown;
};

export type SessionPolicyResult = "authenticated" | "invalid" | "inactive";

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

export function classifyRefreshFailure(
  status: number | null,
): "invalid" | "unavailable" {
  return status !== null && [400, 401, 403].includes(status)
    ? "invalid"
    : "unavailable";
}
