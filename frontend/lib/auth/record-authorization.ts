import {
  hasPermission,
  type AppRole,
  type AuthorizationResource,
} from "./authorization.ts";
import { canTransitionExpediente, EXPEDIENTE_STATES, type ExpedienteState } from "../records/workflow.ts";

export type RecordOperation =
  | "read"
  | "create"
  | "correct"
  | "confirm"
  | "reject"
  | "read_document"
  | "soft_delete"
  | "restore"
  | "hard_delete";

export type RecordSession =
  | { authenticated: false }
  | { authenticated: true; user: { id: string; role: AppRole | null } };

export type CurrentRecordState = { id: string; estado: unknown };
export type CurrentRecordLoader = (recordId: string) => Promise<CurrentRecordState | null>;

export type RecordAuthorizationResult =
  | { allowed: true; recordId?: string }
  | { allowed: false; reason: "unauthenticated" | "forbidden" | "missing_record" | "invalid_state" | "final_state" | "unavailable" };

const FINAL_STATES = new Set<ExpedienteState>(["confirmado", "rechazado"]);

function isExpedienteState(value: unknown): value is ExpedienteState {
  return typeof value === "string" && (EXPEDIENTE_STATES as readonly string[]).includes(value);
}

function actionFor(operation: RecordOperation) {
  return operation;
}

/**
 * Autoriza usando una lectura del estado actual hecha por el servidor.
 * No recibe estado del body; la ruta debe cargar el registro desde PocketBase
 * con el cliente autorizado antes de llamar a esta función.
 */
export async function authorizeRecordOperation(
  session: RecordSession,
  resource: Extract<AuthorizationResource, "nombramientos" | "declaraciones">,
  operation: RecordOperation,
  recordId?: string,
  loadCurrentRecord?: CurrentRecordLoader,
): Promise<RecordAuthorizationResult> {
  if (!session.authenticated) return { allowed: false, reason: "unauthenticated" };
  const role = session.user.role;
  if (!role || !hasPermission(role, resource, actionFor(operation))) {
    return { allowed: false, reason: "forbidden" };
  }
  if (operation === "hard_delete") return { allowed: false, reason: "forbidden" };
  if (operation === "create" || operation === "read") return { allowed: true };
  if (!recordId || !loadCurrentRecord) return { allowed: false, reason: "unavailable" };

  let current: CurrentRecordState | null;
  try {
    current = await loadCurrentRecord(recordId);
  } catch {
    return { allowed: false, reason: "unavailable" };
  }
  if (!current || current.id !== recordId) return { allowed: false, reason: "missing_record" };
  if (!isExpedienteState(current.estado)) return { allowed: false, reason: "invalid_state" };
  if ((operation === "correct" || operation === "confirm" || operation === "reject") && FINAL_STATES.has(current.estado)) {
    return { allowed: false, reason: "final_state" };
  }

  if (operation === "confirm" && !canTransitionExpediente(current.estado, "confirmado")) {
    return { allowed: false, reason: "invalid_state" };
  }
  if (operation === "reject" && !canTransitionExpediente(current.estado, "rechazado")) {
    return { allowed: false, reason: "invalid_state" };
  }
  return { allowed: true, recordId };
}
