import { getVerifiedSessionContext } from "@/lib/auth/server";
import { runAfterSessionPermission } from "@/lib/auth/extraction-gate";
import {
  clearAbsoluteSessionCookie,
  serializeAbsoluteSessionCookie,
} from "@/lib/auth/absolute-session";
import {
  clearPocketBaseAuthCookie,
  noStoreJson,
} from "@/lib/auth/http";
import {
  exportPocketBaseAuthCookie,
  PocketBaseConfigurationError,
} from "@/lib/pocketbase/server";
import { checkPocketBaseHealth } from "@/lib/pocketbase/url";

/** Diagnóstico mínimo, solo para la cuenta administradora verificada. */
export async function GET(request: Request) {
  const guarded = await runAfterSessionPermission(
    () => getVerifiedSessionContext(request.headers.get("cookie")),
    () => {
      const response = noStoreJson({ error: "Se requiere una sesión activa." }, 401);
      response.headers.append("Set-Cookie", clearPocketBaseAuthCookie());
      response.headers.append("Set-Cookie", clearAbsoluteSessionCookie());
      return response;
    },
    () => noStoreJson({ error: "El servicio de autenticación no está disponible." }, 503),
    () => noStoreJson({ error: "No tienes permiso para consultar este diagnóstico." }, 403),
    (context) => context.session.user.isAdmin,
    async () => {
      const reachable = await checkPocketBaseHealth(process.env.POCKETBASE_URL);
      return noStoreJson(
        { reachable },
        reachable ? 200 : 503,
      );
    },
  );

  if (guarded.kind === "authenticated") {
    try {
      guarded.response.headers.append(
        "Set-Cookie",
        exportPocketBaseAuthCookie(
          guarded.context.pocketBase,
          guarded.context.deadline.expiresAt,
        ),
      );
      guarded.response.headers.append(
        "Set-Cookie",
        serializeAbsoluteSessionCookie(guarded.context.deadline),
      );
    } catch (error) {
      if (error instanceof PocketBaseConfigurationError) {
        return noStoreJson({ error: "No se pudo verificar la conexión." }, 503);
      }
      return noStoreJson({ error: "No se pudo verificar la conexión." }, 503);
    }
  }

  return guarded.response;
}
