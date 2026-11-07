import { ClientResponseError } from "pocketbase";
import {
  getVerifiedSessionContext,
  SessionVerificationError,
} from "@/lib/auth/server";
import { authorizeRecordOperation } from "@/lib/auth/record-authorization";
import { hasPermission } from "@/lib/auth/authorization";
import { noStoreJson } from "@/lib/auth/http";
import {
  serializeAbsoluteSessionCookie,
  SessionSigningConfigurationError,
} from "@/lib/auth/absolute-session";
import {
  exportPocketBaseAuthCookie,
  PocketBaseConfigurationError,
} from "@/lib/pocketbase/server";
import { projectDeclaracion } from "@/lib/records/projections";

function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const sessionContext = await getVerifiedSessionContext(
      request.headers.get("cookie"),
    );

    if (!sessionContext.authenticated) {
      return noStoreJson({ error: "Se requiere una sesión activa." }, 401);
    }

    const role = sessionContext.session.user.role;
    if (!role || !hasPermission(role, "declaraciones", "read")) {
      return noStoreJson({ error: "No tienes permiso para consultar declaraciones." }, 403);
    }

    const record = await sessionContext.pocketBase
      .collection("declaraciones")
      .getOne<Record<string, unknown>>(id);

    const dto = projectDeclaracion(role, record);
    const response = noStoreJson(dto);
    response.headers.append(
      "Set-Cookie",
      exportPocketBaseAuthCookie(
        sessionContext.pocketBase,
        sessionContext.deadline.expiresAt,
      ),
    );
    response.headers.append(
      "Set-Cookie",
      serializeAbsoluteSessionCookie(sessionContext.deadline),
    );
    return response;
  } catch (error) {
    if (error instanceof ClientResponseError && error.status === 404) {
      return noStoreJson({ error: "No se encontró la declaración." }, 404);
    }

    if (error instanceof PocketBaseConfigurationError) {
      return noStoreJson({ error: "La autenticación no está configurada." }, 500);
    }

    if (error instanceof SessionSigningConfigurationError) {
      return noStoreJson({ error: "La autenticación no está configurada." }, 500);
    }

    if (error instanceof SessionVerificationError) {
      return noStoreJson(
        { error: "El servicio de autenticación no está disponible." },
        503,
      );
    }

    return noStoreJson({ error: "No fue posible verificar la sesión." }, 503);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const sessionContext = await getVerifiedSessionContext(
      request.headers.get("cookie"),
    );

    if (!sessionContext.authenticated) {
      return noStoreJson({ error: "Se requiere una sesión activa." }, 401);
    }

    const role = sessionContext.session.user.role;
    if (!role || !hasPermission(role, "declaraciones", "soft_delete")) {
      return noStoreJson({ error: "No tienes permiso para eliminar declaraciones." }, 403);
    }

    const authz = await authorizeRecordOperation(
      sessionContext.session,
      "declaraciones",
      "soft_delete",
      id,
      async (recordId) => {
        try {
          const record = await sessionContext.pocketBase
            .collection("declaraciones")
            .getOne<Record<string, unknown>>(recordId);
          return { id: recordId, estado: record.estado_proceso };
        } catch (inner) {
          if (inner instanceof ClientResponseError && inner.status === 404) return null;
          throw inner;
        }
      },
    );

    if (!authz.allowed) {
      if (authz.reason === "missing_record") {
        return noStoreJson({ error: "No se encontró la declaración." }, 404);
      }
      if (authz.reason === "unauthenticated") {
        return noStoreJson({ error: "Se requiere una sesión activa." }, 401);
      }
      if (authz.reason === "forbidden") {
        return noStoreJson({ error: "No tienes permiso para eliminar declaraciones." }, 403);
      }
      if (authz.reason === "invalid_state" || authz.reason === "final_state") {
        return noStoreJson({ error: "El estado del expediente no permite esta operación." }, 409);
      }
      return noStoreJson({ error: "La operación no está disponible." }, 503);
    }

    await sessionContext.pocketBase.collection("declaraciones").update(id, {
      delete_at: toIsoDate(new Date()),
    });

    const response = noStoreJson({ success: true });
    response.headers.append(
      "Set-Cookie",
      exportPocketBaseAuthCookie(
        sessionContext.pocketBase,
        sessionContext.deadline.expiresAt,
      ),
    );
    response.headers.append(
      "Set-Cookie",
      serializeAbsoluteSessionCookie(sessionContext.deadline),
    );
    return response;
  } catch (error) {
    if (error instanceof ClientResponseError && error.status === 404) {
      return noStoreJson({ error: "No se encontró la declaración." }, 404);
    }

    if (error instanceof PocketBaseConfigurationError) {
      return noStoreJson({ error: "La autenticación no está configurada." }, 500);
    }

    if (error instanceof SessionSigningConfigurationError) {
      return noStoreJson({ error: "La autenticación no está configurada." }, 500);
    }

    if (error instanceof SessionVerificationError) {
      return noStoreJson(
        { error: "El servicio de autenticación no está disponible." },
        503,
      );
    }

    return noStoreJson({ error: "No fue posible verificar la sesión." }, 503);
  }
}

