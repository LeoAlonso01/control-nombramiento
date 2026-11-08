import test from "node:test";
import assert from "node:assert/strict";
import {
  classifyRefreshFailure,
  classifySessionState,
} from "../../lib/auth/session-policy.ts";
import {
  APP_ROLES,
  AUTHORIZATION_ACTIONS,
  AUTHORIZATION_POLICY,
  AUTHORIZATION_RESOURCES,
  hasPermission,
  resolveAppRole,
} from "../../lib/auth/authorization.ts";
import { parsePocketBaseUrl } from "../../lib/pocketbase/url.ts";
import { resolveDashboardAccess } from "../../lib/auth/dashboard-access.ts";
import {
  canSubmitCredentials,
  createLoginRequest,
  isLoginSuccessful,
  isValidCurp,
  LOGIN_ENDPOINT,
  loginFailureMessage,
  normalizeCurp,
} from "../../app/login/login-contract.ts";
import {
  runAfterSessionPermission,
  runAfterSessionVerification,
} from "../../lib/auth/extraction-gate.ts";
import {
  createLogoutRequest,
  isLogoutSuccessful,
  LOGOUT_ENDPOINT,
} from "../../lib/auth/logout-contract.ts";

test("authorization matrix defines every role, resource, and action combination", () => {
  assert.deepEqual(Object.keys(AUTHORIZATION_POLICY).sort(), [...APP_ROLES].sort());

  for (const role of APP_ROLES) {
    assert.deepEqual(
      Object.keys(AUTHORIZATION_POLICY[role]).sort(),
      [...AUTHORIZATION_RESOURCES].sort(),
    );

    for (const resource of AUTHORIZATION_RESOURCES) {
      for (const action of AUTHORIZATION_ACTIONS) {
        assert.equal(
          hasPermission(role, resource, action),
          AUTHORIZATION_POLICY[role][resource].includes(action),
          `${role} ${action} ${resource}`,
        );
      }
    }
  }
});

test("authorization policy grants the approved operations and denies physical deletion", () => {
  for (const resource of AUTHORIZATION_RESOURCES) {
    for (const action of AUTHORIZATION_ACTIONS) {
      assert.equal(
        hasPermission("admin", resource, action),
        resource === "permissions"
          ? action === "manage"
          : ["nombramientos", "declaraciones"].includes(resource) &&
            ["read", "create", "correct", "confirm", "reject", "read_document", "soft_delete", "restore"].includes(action),
        `admin ${action} ${resource}`,
      );

      assert.equal(
        hasPermission("capturista", resource, action),
        ["nombramientos", "declaraciones"].includes(resource) &&
          ["read", "create", "correct", "read_document"].includes(action),
        `capturista ${action} ${resource}`,
      );

      assert.equal(
        hasPermission("auditor", resource, action),
        ["nombramientos", "declaraciones"].includes(resource) &&
          action === "read",
        `auditor ${action} ${resource}`,
      );
    }
  }
});

test("unknown roles, resources, and actions are denied by default", () => {
  assert.equal(hasPermission("unknown", "nombramientos", "read"), false);
  assert.equal(hasPermission("admin", "unknown", "read"), false);
  assert.equal(hasPermission("admin", "nombramientos", "unknown"), false);
});

test("configured administrator ID is accepted only when the verified role is admin", () => {
  assert.equal(resolveAppRole("admin-id", " admin-id ", "admin"), "admin");
  assert.equal(resolveAppRole("admin-id", "admin-id", "auditor"), null);
  assert.equal(resolveAppRole("admin-id", "admin-id", null), null);
  assert.equal(resolveAppRole("other-id", "admin-id", "capturista"), "capturista");
  assert.equal(resolveAppRole("other-id", "admin-id"), null);
  assert.equal(resolveAppRole("other-id", undefined, "auditor"), "auditor");
});

test("role resolution accepts only the exact supported runtime strings", () => {
  for (const role of APP_ROLES) {
    assert.equal(resolveAppRole("other-id", undefined, role), role);
  }

  for (const role of [undefined, null, "", "Admin", "unknown", [], {}, 1, true]) {
    assert.equal(resolveAppRole("other-id", undefined, role), null);
  }
});

test("ordinary application roles cannot manage users or hard-delete records", () => {
  for (const role of APP_ROLES) {
    assert.equal(hasPermission(role, "users", "read"), false);
    assert.equal(hasPermission(role, "users", "manage"), false);
    assert.equal(hasPermission(role, "nombramientos", "hard_delete"), false);
    assert.equal(hasPermission(role, "declaraciones", "hard_delete"), false);
  }
});

test("a valid token for the matching user authenticates", () => {
  assert.equal(
    classifySessionState(
      true,
      { id: "test-user", collectionName: "users" },
      "test-user",
    ),
    "authenticated",
  );
});

test("a token issued for another user is rejected", () => {
  assert.equal(
    classifySessionState(
      true,
      { id: "other-user", collectionName: "users" },
      "test-user",
    ),
    "invalid",
  );
});

test("the activo field no longer blocks session verification", () => {
  const record = { id: "test-user", collectionName: "users", activo: false };
  assert.equal(classifySessionState(true, record, "test-user"), "authenticated");
});

test("an invalid or expired token is rejected", () => {
  assert.equal(
    classifySessionState(false, { id: "test-user", collectionName: "users" }, "test-user"),
    "invalid",
  );
  assert.equal(classifyRefreshFailure(401), "invalid");
});

test("PocketBase connection failures remain unavailable, not authenticated", () => {
  assert.equal(classifyRefreshFailure(null), "unavailable");
  assert.equal(classifyRefreshFailure(503), "unavailable");
});

test("PocketBase URL rejects malformed values and embedded credentials", () => {
  assert.equal(parsePocketBaseUrl("not a url"), null);
  assert.equal(parsePocketBaseUrl("https://user:pass@example.test"), null);
  assert.equal(parsePocketBaseUrl("https://example.test/?token=x"), null);
  assert.equal(parsePocketBaseUrl("https://example.test/#fragment"), null);
  assert.equal(parsePocketBaseUrl("ftp://example.test"), null);
  assert.equal(parsePocketBaseUrl("https://example.test")?.origin, "https://example.test");
});

test("dashboard redirects unauthenticated sessions", async () => {
  assert.equal(
    await resolveDashboardAccess(async () => ({ authenticated: false })),
    "unauthenticated",
  );
});

test("dashboard allows a verified active session", async () => {
  assert.equal(
    await resolveDashboardAccess(async () => ({ authenticated: true })),
    "allowed",
  );
});

test("dashboard fails closed when session verification is unavailable", async () => {
  assert.equal(
    await resolveDashboardAccess(async () => {
      throw new Error("simulated PocketBase verification failure");
    }),
    "unavailable",
  );
});

test("login form requires an 18-character CURP and prevents a duplicate", () => {
  assert.equal(canSubmitCredentials("", "", false), false);
  assert.equal(canSubmitCredentials("ABCD010101HDFRRN01", "secret", true), false);
  assert.equal(canSubmitCredentials("ABCD010101HDFRRN01", "", false), false);
  assert.equal(canSubmitCredentials("abcd010101hdfrrn01", "secret", false), true);
  assert.equal(canSubmitCredentials(" curp-incompleta ", "secret", false), false);
});

test("CURP normalization uppercases and trims the captured value", () => {
  assert.equal(normalizeCurp(" abcd010101hdfrrn01 "), "ABCD010101HDFRRN01");
  assert.equal(isValidCurp("ABCD010101HDFRRN01"), true);
  assert.equal(isValidCurp("ABCD010101HDFRRN0"), false);
  assert.equal(isValidCurp("ABCD-010101-DFRRN1"), false);
});

test("login request sends only identity and password in a same-origin JSON POST", () => {
  const request = createLoginRequest("ABCD010101HDFRRN01", "example-password");

  assert.equal(LOGIN_ENDPOINT, "/api/auth/login");
  assert.equal(request.method, "POST");
  assert.equal(request.credentials, "same-origin");
  assert.equal(request.headers["Content-Type"], "application/json");
  assert.deepEqual(JSON.parse(request.body), {
    identity: "ABCD010101HDFRRN01",
    password: "example-password",
  });
  assert.equal(LOGIN_ENDPOINT.includes("@"), false);
});

test("login success requires the API success contract and credential errors stay generic", () => {
  assert.equal(isLoginSuccessful(true, { success: true }), true);
  assert.equal(isLoginSuccessful(true, { success: false }), false);
  assert.equal(isLoginSuccessful(false, { success: true }), false);
  assert.equal(
    loginFailureMessage(401),
    "No fue posible iniciar sesión. Revisa tu CURP y tu contraseña.",
  );
});

test("logout sends a same-origin POST to the existing endpoint without storing credentials", () => {
  const request = createLogoutRequest();

  assert.equal(LOGOUT_ENDPOINT, "/api/auth/logout");
  assert.equal(request.method, "POST");
  assert.equal(request.credentials, "same-origin");
  assert.equal(request.cache, "no-store");
  assert.equal("body" in request, false);
});

test("logout succeeds only when the endpoint returns success", () => {
  assert.equal(isLogoutSuccessful(true, { success: true }), true);
  assert.equal(isLogoutSuccessful(true, { success: false }), false);
  assert.equal(isLogoutSuccessful(false, { success: true }), false);
  assert.equal(isLogoutSuccessful(true, null), false);
});

test("anonymous extraction is denied before document parsing or Gemini", async () => {
  let fileReads = 0;
  let geminiCalls = 0;
  const result = await runAfterSessionPermission(
    async () => ({ authenticated: false, reason: "invalid" }),
    () => "unauthorized",
    () => "unavailable",
    () => "forbidden",
    (context) => context.session.user.role !== null &&
      hasPermission(context.session.user.role, "nombramientos", "create"),
    async () => {
      fileReads += 1;
      geminiCalls += 1;
      return "extracted";
    },
  );

  assert.equal(result.kind, "unauthenticated");
  assert.equal(result.response, "unauthorized");
  assert.equal(fileReads, 0);
  assert.equal(geminiCalls, 0);
});

test("verified active extraction can proceed", async () => {
  let fileReads = 0;
  let geminiCalls = 0;
  const result = await runAfterSessionVerification(
    async () => ({ authenticated: true, user: { id: "test-user" } }),
    () => "unauthorized",
    () => "unavailable",
    async () => {
      fileReads += 1;
      geminiCalls += 1;
      return "extracted";
    },
  );

  assert.equal(result.kind, "authenticated");
  assert.equal(result.response, "extracted");
  assert.equal(fileReads, 1);
  assert.equal(geminiCalls, 1);
});

test("admin and capturista can start extraction through the centralized create permission", async () => {
  for (const role of ["admin", "capturista"]) {
    let formReads = 0;
    let fileReads = 0;
    let geminiCalls = 0;
    const result = await runAfterSessionPermission(
      async () => ({ authenticated: true, session: { user: { role } } }),
      () => "unauthorized",
      () => "unavailable",
      () => "forbidden",
      (context) => context.session.user.role !== null &&
        hasPermission(context.session.user.role, "nombramientos", "create"),
      async () => {
        formReads += 1;
        fileReads += 1;
        geminiCalls += 1;
        return "extracted";
      },
    );

    assert.equal(result.kind, "authenticated");
    assert.equal(result.response, "extracted");
    assert.equal(formReads, 1);
    assert.equal(fileReads, 1);
    assert.equal(geminiCalls, 1);
  }
});

test("auditor, missing role, and invalid role are denied before extraction work", async () => {
  for (const role of ["auditor", null, "unknown", [], {}]) {
    let formReads = 0;
    let fileReads = 0;
    let geminiCalls = 0;
    const result = await runAfterSessionPermission(
      async () => ({ authenticated: true, session: { user: { role } } }),
      () => "unauthorized",
      () => "unavailable",
      () => "forbidden",
      (context) => context.session.user.role !== null &&
        hasPermission(context.session.user.role, "declaraciones", "create"),
      async () => {
        formReads += 1;
        fileReads += 1;
        geminiCalls += 1;
        return "extracted";
      },
    );

    assert.equal(result.kind, "forbidden");
    assert.equal(result.response, "forbidden");
    assert.equal(formReads, 0);
    assert.equal(fileReads, 0);
    assert.equal(geminiCalls, 0);
  }
});

test("invalid extraction sessions are denied before document parsing", async () => {
  let fileReads = 0;
  const result = await runAfterSessionPermission(
    async () => ({ authenticated: false, reason: "invalid" }),
    () => "unauthorized",
    () => "unavailable",
    () => "forbidden",
    (context) => context.session.user.role !== null &&
      hasPermission(context.session.user.role, "nombramientos", "create"),
    async () => {
      fileReads += 1;
      return "extracted";
    },
  );

  assert.equal(result.kind, "unauthenticated");
  assert.equal(fileReads, 0);
});

test("PocketBase verification failure denies extraction without parsing", async () => {
  let fileReads = 0;
  let geminiCalls = 0;
  const result = await runAfterSessionPermission(
    async () => {
      throw new Error("simulated PocketBase outage");
    },
    () => "unauthorized",
    () => "unavailable",
    () => "forbidden",
    (context) => context.session.user.role !== null &&
      hasPermission(context.session.user.role, "nombramientos", "create"),
    async () => {
      fileReads += 1;
      geminiCalls += 1;
      return "extracted";
    },
  );

  assert.equal(result.kind, "unavailable");
  assert.equal(result.response, "unavailable");
  assert.equal(fileReads, 0);
  assert.equal(geminiCalls, 0);
});
