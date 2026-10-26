export const EXPEDIENTE_STATES = [
  "pendiente",
  "procesando",
  "revision_manual",
  "confirmado",
  "error",
  "rechazado",
] as const;

export type ExpedienteState = (typeof EXPEDIENTE_STATES)[number];

const ALLOWED_TRANSITIONS: Record<ExpedienteState, readonly ExpedienteState[]> = {
  pendiente: ["procesando"],
  procesando: ["revision_manual", "error"],
  revision_manual: ["confirmado", "rechazado"],
  confirmado: [],
  error: ["procesando"],
  rechazado: [],
};

/** Contrato puro de transiciones; debe validarse en servidor antes de persistir. */
export function canTransitionExpediente(
  from: ExpedienteState,
  to: ExpedienteState,
): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}
