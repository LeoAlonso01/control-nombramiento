import { noStoreJson, clearPocketBaseAuthCookie, validatePostOrigin } from "@/lib/auth/http";
import { clearAbsoluteSessionCookie } from "@/lib/auth/absolute-session";

/** Valida el origen antes de invalidar las cookies de sesión del navegador. */
export async function POST(request: Request) {
  const origin = validatePostOrigin(request);

  if (!origin.allowed) {
    return noStoreJson(
      {
        error:
          origin.reason === "misconfigured"
            ? "La autenticación no está configurada."
            : "Solicitud no permitida.",
      },
      origin.reason === "misconfigured" ? 500 : 403,
    );
  }

  const response = noStoreJson({ success: true });
  response.headers.append("Set-Cookie", clearPocketBaseAuthCookie());
  response.headers.append("Set-Cookie", clearAbsoluteSessionCookie());
  return response;
}
