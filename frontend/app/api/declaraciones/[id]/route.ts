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
      exportPocketBaseAuthCookie(sessionContext.pocketBase),
    );
    return response;
  } catch (error) {
    if (error instanceof ClientResponseError && error.status === 404) {
      return noStoreJson({ error: "No se encontró la declaración." }, 404);
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
      exportPocketBaseAuthCookie(sessionContext.pocketBase),
    );
    return response;
  } catch (error) {
    if (error instanceof ClientResponseError && error.status === 404) {
      return noStoreJson({ error: "No se encontró la declaración." }, 404);
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


const DECLARACION_EDITABLE_FIELDS = [
  "nombre_declarante",
  "curp_declarante",
  "lugar_declaracion",
  "fecha",
  "tipo_declaracion",
  "fecha_recepcion",
  "periodo_correspondiente",
  "observaciones",
] as const;

type EditableField =
  (typeof DECLARACION_EDITABLE_FIELDS)[number];

const DECLARACION_TYPES = [
  "inicio",
  "modificacion",
  "conclusion",
] as const;

function isPlainObject(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function normalizeDate(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    return null;
  }

  return date.toISOString();
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;

    const sessionContext = await getVerifiedSessionContext(
      request.headers.get("cookie"),
    );

    if (!sessionContext.authenticated) {
      return noStoreJson(
        { error: "Se requiere una sesión activa." },
        401,
      );
    }

    const role = sessionContext.session.user.role;

    if (
      !role ||
      !hasPermission(role, "declaraciones", "correct")
    ) {
      return noStoreJson(
        { error: "No tienes permiso para editar declaraciones." },
        403,
      );
    }

    const authz = await authorizeRecordOperation(
      sessionContext.session,
      "declaraciones",
      "correct",
      id,
      async (recordId) => {
        try {
          const record = await sessionContext.pocketBase
            .collection("declaraciones")
            .getOne<Record<string, unknown>>(recordId);

          // Impedir editar expedientes eliminados lógicamente.
          if (
            typeof record.delete_at === "string" &&
            record.delete_at.trim() !== ""
          ) {
            return null;
          }

          return {
            id: recordId,
            estado: record.estado_proceso,
          };
        } catch (error) {
          if (
            error instanceof ClientResponseError &&
            error.status === 404
          ) {
            return null;
          }

          throw error;
        }
      },
    );

    if (!authz.allowed) {
      switch (authz.reason) {
        case "unauthenticated":
          return noStoreJson(
            { error: "Se requiere una sesión activa." },
            401,
          );

        case "forbidden":
          return noStoreJson(
            { error: "No tienes permiso para editar declaraciones." },
            403,
          );

        case "missing_record":
          return noStoreJson(
            { error: "No se encontró una declaración activa." },
            404,
          );

        case "final_state":
          return noStoreJson(
            {
              error:
                "No se pueden editar declaraciones confirmadas o rechazadas.",
            },
            409,
          );

        case "invalid_state":
          return noStoreJson(
            {
              error:
                "El estado del expediente no permite esta operación.",
            },
            409,
          );

        default:
          return noStoreJson(
            { error: "No fue posible autorizar la operación." },
            503,
          );
      }
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return noStoreJson(
        { error: "El cuerpo de la petición no es JSON válido." },
        400,
      );
    }

    if (!isPlainObject(body)) {
      return noStoreJson(
        { error: "Se esperaba un objeto JSON." },
        400,
      );
    }

    const keys = Object.keys(body);

    if (keys.length === 0) {
      return noStoreJson(
        { error: "No se recibieron campos para actualizar." },
        400,
      );
    }

    const allowedFields = new Set<string>(
      DECLARACION_EDITABLE_FIELDS,
    );

    for (const key of keys) {
      if (!allowedFields.has(key)) {
        return noStoreJson(
          { error: `El campo "${key}" no puede modificarse.` },
          400,
        );
      }
    }

    const updateData: Partial<
      Record<EditableField, string>
    > = {};

    for (const key of keys as EditableField[]) {
      const value = body[key];

      if (typeof value !== "string") {
        return noStoreJson(
          { error: `El campo "${key}" debe ser texto.` },
          400,
        );
      }

      const normalized = value.trim();

      if (normalized.length > 5000) {
        return noStoreJson(
          { error: `El campo "${key}" es demasiado largo.` },
          400,
        );
      }

      if (
        key === "tipo_declaracion" &&
        normalized !== "" &&
        !DECLARACION_TYPES.includes(
          normalized as (typeof DECLARACION_TYPES)[number],
        )
      ) {
        return noStoreJson(
          { error: "El tipo de declaración no es válido." },
          400,
        );
      }

      if (key === "curp_declarante" && normalized !== "") {
        if (
          !/^[A-ZÑ&]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d$/.test(
            normalized.toUpperCase(),
          )
        ) {
          return noStoreJson(
            { error: "La CURP no tiene un formato válido." },
            400,
          );
        }

        updateData[key] = normalized.toUpperCase();
        continue;
      }

      if (key === "fecha" || key === "fecha_recepcion") {
        if (normalized === "") {
          updateData[key] = "";
          continue;
        }

        const isoDate = normalizeDate(normalized);

        if (!isoDate) {
          return noStoreJson(
            {
              error:
                `La fecha del campo "${key}" no es válida. Usa AAAA-MM-DD.`,
            },
            400,
          );
        }

        updateData[key] = isoDate;
        continue;
      }

      updateData[key] = normalized;
    }

    const updated = await sessionContext.pocketBase
      .collection("declaraciones")
      .update<Record<string, unknown>>(id, updateData);

    const response = noStoreJson(
      projectDeclaracion(role, updated),
    );

    response.headers.append(
      "Set-Cookie",
      exportPocketBaseAuthCookie(sessionContext.pocketBase),
    );

    return response;
  } catch (error) {
    if (error instanceof ClientResponseError) {
      if (error.status === 404) {
        return noStoreJson(
          { error: "No se encontró la declaración." },
          404,
        );
      }

      if (error.status === 400) {
        return noStoreJson(
          { error: "PocketBase rechazó los datos enviados." },
          400,
        );
      }

      if (error.status === 403) {
        return noStoreJson(
          { error: "PocketBase no autorizó la actualización." },
          403,
        );
      }
    }

    if (error instanceof PocketBaseConfigurationError) {
      return noStoreJson(
        { error: "La autenticación no está configurada." },
        500,
      );
    }

    if (error instanceof SessionVerificationError) {
      return noStoreJson(
        {
          error:
            "El servicio de autenticación no está disponible.",
        },
        503,
      );
    }

    console.error("Error al actualizar declaración:", error);

    return noStoreJson(
      { error: "No fue posible actualizar la declaración." },
      503,
    );
  }
}

