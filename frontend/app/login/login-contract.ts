export const LOGIN_ENDPOINT = "/api/auth/login";

const CURP_INPUT_PATTERN = /^[A-Z0-9]{18}$/;

/** Normaliza la CURP capturada para que coincida con el valor almacenado. */
export function normalizeCurp(value: string): string {
  return value.trim().toUpperCase();
}

/** Verifica la forma de la CURP (18 caracteres alfanuméricos) antes de enviar. */
export function isValidCurp(value: string): boolean {
  return CURP_INPUT_PATTERN.test(normalizeCurp(value));
}

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
  if (status === 401) return "No fue posible iniciar sesión. Revisa tu CURP y tu contraseña.";
  if (status === 400) return "Revisa la CURP y la contraseña e inténtalo de nuevo.";
  if (status === 403) return "La solicitud no pudo ser aceptada. Recarga la página e inténtalo de nuevo.";
  return "El servicio de autenticación no está disponible. Intenta de nuevo más tarde.";
}

/** Validación de conveniencia para la interfaz; el servidor vuelve a validar la entrada. */
export function canSubmitCredentials(
  identity: string,
  password: string,
  isSubmitting: boolean,
): boolean {
  return !isSubmitting && isValidCurp(identity) && Boolean(password);
}
