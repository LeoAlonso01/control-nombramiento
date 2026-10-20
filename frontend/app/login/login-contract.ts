export const LOGIN_ENDPOINT = "/api/auth/login";

/** Contrato de petición same-origin; las credenciales no se guardan en el navegador. */
export function createLoginRequest(identity: string, password: string): RequestInit {
  return {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identity, password }),
    cache: "no-store",
  };
}

/** Exige que HTTP y el cuerpo confirmen éxito antes de navegar al área protegida. */
export function isLoginSuccessful(
  responseOk: boolean,
  payload: { success?: unknown } | null,
): boolean {
  return responseOk && payload?.success === true;
}

/** Mantiene mensajes genéricos para no revelar causas internas de autenticación. */
export function loginFailureMessage(status: number): string {
  if (status === 401) return "No fue posible iniciar sesión. Revisa tus datos e inténtalo de nuevo.";
  if (status === 400) return "Revisa los datos ingresados e inténtalo de nuevo.";
  if (status === 403) return "La solicitud no pudo ser aceptada. Recarga la página e inténtalo de nuevo.";
  return "El servicio de autenticación no está disponible. Intenta de nuevo más tarde.";
}

/** Validación de conveniencia para la interfaz; el servidor vuelve a validar la entrada. */
export function canSubmitCredentials(
  identity: string,
  password: string,
  isSubmitting: boolean,
): boolean {
  return !isSubmitting && Boolean(identity.trim()) && Boolean(password);
}
