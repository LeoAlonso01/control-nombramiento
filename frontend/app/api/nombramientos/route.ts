import { getVerifiedSessionContext } from "@/lib/auth/server";
import { hasPermission } from "@/lib/auth/authorization";
import { noStoreJson } from "@/lib/auth/http";

/**
 * La lista está preparada en lib/records/nombramientos, pero el estado activo
 * confirmado es Admins only. No se emite una consulta ni se devuelven registros
 * hasta que el acceso de lectura para roles de aplicación sea autorizado y probado.
 */
export async function GET(request: Request) {
  try {
    const context = await getVerifiedSessionContext(request.headers.get("cookie"));
    if (!context.authenticated) {
      return noStoreJson({ error: "Se requiere una sesión activa." }, 401);
    }
    const role = context.session.user.role;
    if (!role || !hasPermission(role, "nombramientos", "read")) {
      return noStoreJson({ error: "No tienes permiso para consultar nombramientos." }, 403);
    }
    return noStoreJson(
      { error: "La consulta de nombramientos está pendiente de habilitarse en PocketBase." },
      503,
    );
  } catch {
    // No se registran errores externos ni contenido de registros/documentos.
    return noStoreJson({ error: "No fue posible verificar la sesión." }, 503);
  }
}
