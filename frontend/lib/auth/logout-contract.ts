export const LOGOUT_ENDPOINT = "/api/auth/logout";

/** Mantiene la petición de cierre de sesión en el mismo origen y sin caché. */
export function createLogoutRequest(): RequestInit {
  return {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
  };
}

/** Requiere éxito HTTP y el contrato explícito del endpoint antes de limpiar UI. */
export function isLogoutSuccessful(
  responseOk: boolean,
  payload: { success?: unknown } | null,
): boolean {
  return responseOk && payload?.success === true;
}
