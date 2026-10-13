import { ClientResponseError, type RecordModel } from "pocketbase";
import {
  noStoreJson,
  readLimitedJsonBody,
  validatePostOrigin,
} from "@/lib/auth/http";
import {
  exportPocketBaseAuthCookie,
  createPocketBaseServer,
  PocketBaseConfigurationError,
} from "@/lib/pocketbase/server";
import {
  assertSessionSigningConfigured,
  createAbsoluteSessionDeadline,
  serializeAbsoluteSessionCookie,
  SessionSigningConfigurationError,
} from "@/lib/auth/absolute-session";

type UserAuthRecord = RecordModel & { activo?: unknown };

const LOGIN_FAILED = "No fue posible iniciar sesión.";

export async function POST(request: Request) {
  const origin = validatePostOrigin(request);

  if (!origin.allowed) {
    return noStoreJson(
      { error: origin.reason === "misconfigured" ? "La autenticación no está configurada." : "Solicitud no permitida." },
      origin.reason === "misconfigured" ? 500 : 403,
    );
  }

  const body = await readLimitedJsonBody(request);

  if (!body.ok) {
    return noStoreJson({ error: body.message }, body.status);
  }

  if (
    typeof body.value !== "object" ||
    body.value === null ||
    Array.isArray(body.value)
  ) {
    return noStoreJson({ error: "La solicitud no es válida." }, 400);
  }

  const credentials = body.value as Record<string, unknown>;
  const keys = Object.keys(credentials);

  if (
    keys.length !== 2 ||
    !Object.hasOwn(credentials, "identity") ||
    !Object.hasOwn(credentials, "password") ||
    typeof credentials.identity !== "string" ||
    typeof credentials.password !== "string"
  ) {
    return noStoreJson({ error: "La solicitud no es válida." }, 400);
  }

  const identity = credentials.identity.trim();
  const password = credentials.password;

  if (
    identity.length === 0 ||
    identity.length > 255 ||
    password.length === 0 ||
    password.length > 1024
  ) {
    return noStoreJson({ error: "La solicitud no es válida." }, 400);
  }

  try {
    assertSessionSigningConfigured();
    const pb = createPocketBaseServer();
    const { record } = await pb
      .collection("users")
      .authWithPassword<UserAuthRecord>(identity, password);

    if (record.collectionName !== "users" || record.activo !== true) {
      pb.authStore.clear();
      return noStoreJson({ error: LOGIN_FAILED }, 401);
    }

    const deadline = createAbsoluteSessionDeadline(record.id);
    pb.authStore.save(pb.authStore.token, {
      id: record.id,
      collectionId: record.collectionId,
      collectionName: record.collectionName,
      activo: record.activo,
    });

    const response = noStoreJson({ success: true });
    response.headers.append(
      "Set-Cookie",
      exportPocketBaseAuthCookie(pb, deadline.expiresAt),
    );
    response.headers.append("Set-Cookie", serializeAbsoluteSessionCookie(deadline));
    return response;
  } catch (error) {
    if (error instanceof ClientResponseError) {
      if ([400, 401, 403].includes(error.status)) {
        return noStoreJson({ error: LOGIN_FAILED }, 401);
      }

      return noStoreJson(
        { error: "El servicio de autenticación no está disponible." },
        503,
      );
    }

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

    return noStoreJson(
      { error: "El servicio de autenticación no está disponible." },
      503,
    );
  }
}
