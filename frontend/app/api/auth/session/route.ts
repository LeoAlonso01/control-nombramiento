import {
  getVerifiedSessionContext,
  SessionVerificationError,
} from "@/lib/auth/server";
import { noStoreJson, clearPocketBaseAuthCookie } from "@/lib/auth/http";
import {
  clearAbsoluteSessionCookie,
  serializeAbsoluteSessionCookie,
  SessionSigningConfigurationError,
} from "@/lib/auth/absolute-session";
import {
  exportPocketBaseAuthCookie,
  PocketBaseConfigurationError,
} from "@/lib/pocketbase/server";

/** Renueva la sesión verificada o elimina ambas cookies cuando deja de ser válida. */
export async function GET(request: Request) {
  try {
    const context = await getVerifiedSessionContext(
      request.headers.get("cookie"),
    );

    if (!context.authenticated) {
      const response = noStoreJson({ authenticated: false });
      response.headers.append("Set-Cookie", clearPocketBaseAuthCookie());
      response.headers.append("Set-Cookie", clearAbsoluteSessionCookie());
      return response;
    }

    const response = noStoreJson({
      authenticated: true,
      user: context.session.user,
    });
    response.headers.append(
      "Set-Cookie",
      exportPocketBaseAuthCookie(context.pocketBase, context.deadline.expiresAt),
    );
    response.headers.append(
      "Set-Cookie",
      serializeAbsoluteSessionCookie(context.deadline),
    );
    return response;
  } catch (error) {
    if (error instanceof PocketBaseConfigurationError) {
      return noStoreJson(
        { error: "La autenticación no está configurada." },
        500,
      );
    }

    if (error instanceof SessionSigningConfigurationError) {
      return noStoreJson(
        { error: "La autenticación no está configurada." },
        500,
      );
    }

    if (error instanceof SessionVerificationError) {
      return noStoreJson(
        { error: "El servicio de autenticación no está disponible." },
        503,
      );
    }

    return noStoreJson(
      { error: "El servicio de autenticación no está disponible." },
      503,
    );
  }
}
