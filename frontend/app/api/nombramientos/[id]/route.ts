import { ClientResponseError } from "pocketbase";
import {
  getVerifiedSessionContext,
  SessionVerificationError,
} from "@/lib/auth/server";
import { authorizeRecordOperation } from "@/lib/auth/record-authorization";
import { hasPermission } from "@/lib/auth/authorization";
import { noStoreJson } from "@/lib/auth/http";
import {
  exportPocketBaseAuthCookie,
  PocketBaseConfigurationError,
} from "@/lib/pocketbase/server";
import { projectNombramiento } from "@/lib/records/projections";
import { isValidIsoDate } from "@/lib/records/contracts";

function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}


function normalizeText(value: unknown, max: number): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") throw new TypeError("invalid_body");
  const trimmed = value.trim();
  if (!trimmed.length) return null;
  if (trimmed.length > max) throw new TypeError("invalid_body");
  return trimmed;
}

function normalizeOptionalIsoDate(value: unknown): string | null {
  const text = normalizeText(value, 40);
  if (text && !isValidIsoDate(text)) throw new TypeError("invalid_body");
  return text;
}

type NombramientoPatchBody = {
  numero_nombramiento?: unknown;
  nombre_funcionario?: unknown;
  cargo?: unknown;
  fecha_recepcion?: unknown;
  fecha_nombramiento?: unknown;
  periodo_correspondiente?: unknown;
  estado_proceso?: unknown;
  observaciones?: unknown;
};

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const sessionContext = await getVerifiedSessionContext(request.headers.get("cookie"));

    if (!sessionContext.authenticated) {
      return noStoreJson({ error: "Se requiere una sesión activa." }, 401);
    }

    const role = sessionContext.session.user.role;
    if (!role || !hasPermission(role, "nombramientos", "correct")) {
      return noStoreJson({ error: "No tienes permiso para editar nombramientos." }, 403);
    }

    const body: unknown = await request.json().catch(() => null);
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return noStoreJson({ error: "El cuerpo de la solicitud no es válido." }, 400);
    }

    const allowedKeys = new Set([
      "numero_nombramiento",
      "nombre_funcionario",
      "cargo",
      "fecha_recepcion",
      "fecha_nombramiento",
      "periodo_correspondiente",
      "estado_proceso",
      "observaciones",
    ]);

    for (const key of Object.keys(body as Record<string, unknown>)) {
      if (!allowedKeys.has(key)) {
        return noStoreJson({ error: "El cuerpo de la solicitud no es válido." }, 400);
      }
    }

    const payload = body as NombramientoPatchBody;

    const authz = await authorizeRecordOperation(
      sessionContext.session,
      "nombramientos",
      "correct",
      id,
      async (recordId) => {
        try {
          const record = await sessionContext.pocketBase
            .collection("nombramientos")
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
        return noStoreJson({ error: "No se encontró el nombramiento." }, 404);
      }
      if (authz.reason === "unauthenticated") {
        return noStoreJson({ error: "Se requiere una sesión activa." }, 401);
      }
      if (authz.reason === "forbidden") {
        return noStoreJson({ error: "No tienes permiso para editar nombramientos." }, 403);
      }
      if (authz.reason === "invalid_state" || authz.reason === "final_state") {
        return noStoreJson({ error: "El estado del expediente no permite esta operación." }, 409);
      }
      return noStoreJson({ error: "La operación no está disponible." }, 503);
    }

    const updateData: Record<string, unknown> = {};

    const numero = normalizeText(payload.numero_nombramiento, 160);
    if (numero !== null) updateData.numero_nombramiento = numero;

    const nombre = normalizeText(payload.nombre_funcionario, 200);
    if (nombre !== null) updateData.nombre_funcionario = nombre;

    const cargo = normalizeText(payload.cargo, 200);
    if (cargo !== null) updateData.cargo = cargo;

    const fechaRecepcion = normalizeOptionalIsoDate(payload.fecha_recepcion);
    if (fechaRecepcion !== null) updateData.fecha_recepcion = fechaRecepcion;

    const fechaNombramiento = normalizeOptionalIsoDate(payload.fecha_nombramiento);
    if (fechaNombramiento !== null) updateData.fecha_nombramiento = fechaNombramiento;

    const periodo = normalizeText(payload.periodo_correspondiente, 40);
    if (periodo !== null) updateData.periodo_correspondiente = periodo;

    const estado = normalizeText(payload.estado_proceso, 40);
    if (estado !== null) updateData.estado_proceso = estado;

    const observaciones = normalizeText(payload.observaciones, 10_000);
    if (observaciones !== null) updateData.observaciones = observaciones;

    await sessionContext.pocketBase.collection("nombramientos").update(id, updateData);

    const record = await sessionContext.pocketBase
      .collection("nombramientos")
      .getOne<Record<string, unknown>>(id);

    const dto = projectNombramiento(role, record);
    const response = noStoreJson(dto);
    response.headers.append(
      "Set-Cookie",
      exportPocketBaseAuthCookie(sessionContext.pocketBase),
    );
    return response;
  } catch (error) {
    if (error instanceof ClientResponseError && error.status === 404) {
      return noStoreJson({ error: "No se encontró el nombramiento." }, 404);
    }

    if (error instanceof TypeError && error.message === "invalid_body") {
      return noStoreJson({ error: "El cuerpo de la solicitud no es válido." }, 400);
    }

    if (error instanceof PocketBaseConfigurationError) {
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


export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const sessionContext = await getVerifiedSessionContext(
      _request.headers.get("cookie"),
    );

    if (!sessionContext.authenticated) {
      return noStoreJson({ error: "Se requiere una sesión activa." }, 401);
    }

    const role = sessionContext.session.user.role;
    if (!role || !hasPermission(role, "nombramientos", "read")) {
      return noStoreJson({ error: "No tienes permiso para consultar nombramientos." }, 403);
    }

    const record = await sessionContext.pocketBase
      .collection("nombramientos")
      .getOne<Record<string, unknown>>(id);

    const dto = projectNombramiento(role, record);
    const response = noStoreJson(dto);
    response.headers.append(
      "Set-Cookie",
      exportPocketBaseAuthCookie(sessionContext.pocketBase),
    );
    return response;
  } catch (error) {
    if (error instanceof ClientResponseError && error.status === 404) {
      return noStoreJson({ error: "No se encontró el nombramiento." }, 404);
    }

    if (error instanceof PocketBaseConfigurationError) {
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
    if (!role || !hasPermission(role, "nombramientos", "soft_delete")) {
      return noStoreJson({ error: "No tienes permiso para eliminar nombramientos." }, 403);
    }

    const authz = await authorizeRecordOperation(
      sessionContext.session,
      "nombramientos",
      "soft_delete",
      id,
      async (recordId) => {
        try {
          const record = await sessionContext.pocketBase
            .collection("nombramientos")
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
        return noStoreJson({ error: "No se encontró el nombramiento." }, 404);
      }
      if (authz.reason === "unauthenticated") {
        return noStoreJson({ error: "Se requiere una sesión activa." }, 401);
      }
      if (authz.reason === "forbidden") {
        return noStoreJson({ error: "No tienes permiso para eliminar nombramientos." }, 403);
      }
      if (authz.reason === "invalid_state" || authz.reason === "final_state") {
        return noStoreJson({ error: "El estado del expediente no permite esta operación." }, 409);
      }
      return noStoreJson({ error: "La operación no está disponible." }, 503);
    }

    await sessionContext.pocketBase.collection("nombramientos").update(id, {
      delete_at: toIsoDate(new Date()),
    });

    const response = noStoreJson({ success: true });
    response.headers.append(
      "Set-Cookie",
      exportPocketBaseAuthCookie(sessionContext.pocketBase),
    );
    return response;
  } catch (error) {
    if (error instanceof ClientResponseError && error.status === 404) {
      return noStoreJson({ error: "No se encontró el nombramiento." }, 404);
    }

    if (error instanceof PocketBaseConfigurationError) {
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

