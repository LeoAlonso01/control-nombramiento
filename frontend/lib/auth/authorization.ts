export const APP_ROLES = ["admin", "capturista", "auditor"] as const;
export type AppRole = (typeof APP_ROLES)[number];

export const AUTHORIZATION_RESOURCES = [
  "users",
  "nombramientos",
  "declaraciones",
  "permissions",
] as const;
export type AuthorizationResource = (typeof AUTHORIZATION_RESOURCES)[number];

export const AUTHORIZATION_ACTIONS = [
  "read",
  "create",
  "correct",
  "confirm",
  "reject",
  "read_document",
  "soft_delete",
  "restore",
  "hard_delete",
  "manage",
] as const;
export type AuthorizationAction = (typeof AUTHORIZATION_ACTIONS)[number];

type PermissionMatrix = Record<
  AppRole,
  Record<AuthorizationResource, readonly AuthorizationAction[]>
>;

const ADMIN_RECORD_ACTIONS: readonly AuthorizationAction[] = [
  "read", "create", "correct", "confirm", "reject", "read_document",
  "soft_delete", "restore",
];
const CAPTURE_ACTIONS: readonly AuthorizationAction[] = [
  "read", "create", "correct", "read_document",
];
const READ_ONLY_ACTIONS: readonly AuthorizationAction[] = ["read"];
const NO_ACTIONS: readonly AuthorizationAction[] = [];

/**
 * Matriz central de permisos de la aplicación. Describe la política, pero no
 * autentica usuarios ni garantiza por sí sola que una ruta la esté aplicando.
 */
export const AUTHORIZATION_POLICY: PermissionMatrix = {
  admin: {
    // No hay endpoints de administración de usuarios en esta fase.
    users: NO_ACTIONS,
    nombramientos: ADMIN_RECORD_ACTIONS,
    declaraciones: ADMIN_RECORD_ACTIONS,
    permissions: ["manage"],
  },
  capturista: {
    users: NO_ACTIONS,
    nombramientos: CAPTURE_ACTIONS,
    declaraciones: CAPTURE_ACTIONS,
    permissions: NO_ACTIONS,
  },
  auditor: {
    users: NO_ACTIONS,
    nombramientos: READ_ONLY_ACTIONS,
    declaraciones: READ_ONLY_ACTIONS,
    permissions: NO_ACTIONS,
  },
};

/** Evalúa una combinación de rol, recurso y acción; las entradas sin permiso se deniegan. */
export function hasPermission(
  role: AppRole,
  resource: AuthorizationResource,
  action: AuthorizationAction,
): boolean {
  const actions: readonly AuthorizationAction[] | undefined =
    AUTHORIZATION_POLICY[role]?.[resource];
  return actions?.includes(action) ?? false;
}

/**
 * Prioriza el ID administrativo configurado y, para las demás cuentas, acepta
 * únicamente un rol válido recibido de una fuente verificada del servidor.
 * La firma `unknown` evita confiar en tipos TypeScript para validar datos externos.
 */
export function resolveAppRole(
  verifiedUserId: string,
  configuredAdminId: string | undefined,
  assignedRole?: unknown,
): AppRole | null {
  const adminId = configuredAdminId?.trim();
  if (adminId && verifiedUserId === adminId) {
    return assignedRole === "admin" ? "admin" : null;
  }
  return typeof assignedRole === "string" && APP_ROLES.includes(assignedRole as AppRole)
    ? (assignedRole as AppRole)
    : null;
}
