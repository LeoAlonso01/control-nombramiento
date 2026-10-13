export const LOGIN_ENDPOINT = "/api/auth/login";

export function createLoginRequest(identity: string, password: string): RequestInit {
  return {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identity, password }),
    cache: "no-store",
  };
}

export function isLoginSuccessful(
  responseOk: boolean,
  payload: { success?: unknown } | null,
): boolean {
  return responseOk && payload?.success === true;
}

export function loginFailureMessage(status: number): string {
  if (status === 401) return "No fue posible iniciar sesión. Revisa tus datos e inténtalo de nuevo.";
  if (status === 400) return "Revisa los datos ingresados e inténtalo de nuevo.";
  if (status === 403) return "La solicitud no pudo ser aceptada. Recarga la página e inténtalo de nuevo.";
  return "El servicio de autenticación no está disponible. Intenta de nuevo más tarde.";
}

export function canSubmitCredentials(
  identity: string,
  password: string,
  isSubmitting: boolean,
): boolean {
  return !isSubmitting && Boolean(identity.trim()) && Boolean(password);
}
