export const LOGOUT_ENDPOINT = "/api/auth/logout";

export function createLogoutRequest(): RequestInit {
  return {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
  };
}

export function isLogoutSuccessful(
  responseOk: boolean,
  payload: { success?: unknown } | null,
): boolean {
  return responseOk && payload?.success === true;
}
