import { ClientResponseError } from "pocketbase";
import { getVerifiedSessionContext, SessionVerificationError } from "@/lib/auth/server";
import { noStoreJson } from "@/lib/auth/http";
import { exportPocketBaseAuthCookie } from "@/lib/pocketbase/server";
import { buildReport, canReadReports, loadReportRows, parseReportFilters, ReportLimitError, ReportQueryError } from "@/lib/reports/report";

export async function GET(request: Request) {
  try {
    const context = await getVerifiedSessionContext(request.headers.get("cookie"));
    if (!context.authenticated) return noStoreJson({ error: "Se requiere una sesión activa." }, 401);
    if (!canReadReports(context.session.user.role)) return noStoreJson({ error: "No tienes permiso para consultar estos reportes." }, 403);
    const filters = parseReportFilters(new URL(request.url).searchParams);
    const queriedAt = new Date().toISOString();
    const rows = await loadReportRows(context.pocketBase);
    const response = noStoreJson(buildReport(rows, filters, queriedAt));
    response.headers.append("Set-Cookie", exportPocketBaseAuthCookie(context.pocketBase));
    return response;
  } catch (error) {
    if (error instanceof ReportQueryError) return noStoreJson({ error: "Selecciona fechas válidas y un periodo de hasta 366 días." }, 400);
    if (error instanceof ReportLimitError) return noStoreJson({ error: "La consulta supera el límite de 10 000 registros. No se generó un reporte parcial." }, 422);
    if (error instanceof SessionVerificationError) return noStoreJson({ error: "El servicio de autenticación no está disponible." }, 503);
    if (error instanceof ClientResponseError && [401, 403].includes(error.status)) return noStoreJson({ error: "PocketBase denegó el acceso a los datos del reporte." }, 403);
    return noStoreJson({ error: "No se pudo completar el reporte. Revisa la conexión y los permisos e inténtalo de nuevo." }, 503);
  }
}
