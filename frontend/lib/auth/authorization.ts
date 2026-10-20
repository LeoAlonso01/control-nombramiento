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
  "update",
  "delete",
  "manage",
] as const;
export type AuthorizationAction = (typeof AUTHORIZATION_ACTIONS)[number];

type PermissionMatrix = Record<
  AppRole,
  Record<AuthorizationResource, readonly AuthorizationAction[]>
>;

const ALL_ACTIONS: readonly AuthorizationAction[] = AUTHORIZATION_ACTIONS;
const CAPTURE_ACTIONS: readonly AuthorizationAction[] = [
  "read",
  "create",
  "update",
];
const READ_ONLY_ACTIONS: readonly AuthorizationAction[] = ["read"];
const NO_ACTIONS: readonly AuthorizationAction[] = [];

/** Central policy only. This does not resolve or persist a user's assigned role. */
export const AUTHORIZATION_POLICY: PermissionMatrix = {
  admin: {
    users: ALL_ACTIONS,
    nombramientos: ALL_ACTIONS,
    declaraciones: ALL_ACTIONS,
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

/** Unknown runtime values and missing matrix entries are denied. */
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
 * Resolves the configured administrator from a server-verified user ID.
 * `assignedRole` must come from a trusted server-side source. Runtime values are
 * validated because TypeScript types do not validate PocketBase responses.
 */
export function resolveAppRole(
  verifiedUserId: string,
  configuredAdminId: string | undefined,
  assignedRole?: unknown,
): AppRole | null {
  const adminId = configuredAdminId?.trim();
  if (adminId && verifiedUserId === adminId) return "admin";
  return typeof assignedRole === "string" && APP_ROLES.includes(assignedRole as AppRole)
    ? (assignedRole as AppRole)
    : null;
}
