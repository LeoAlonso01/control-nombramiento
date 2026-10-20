import test from "node:test";
import assert from "node:assert/strict";
import {
  ABSOLUTE_SESSION_MAX_AGE_MS,
  ABSOLUTE_SESSION_COOKIE_NAME,
  createAbsoluteSessionDeadline,
  readAbsoluteSessionDeadline,
  serializeAbsoluteSessionCookie,
} from "../../lib/auth/absolute-session.ts";
import {
  classifyRefreshFailure,
  classifySessionState,
} from "../../lib/auth/session-policy.ts";
import { parsePocketBaseUrl } from "../../lib/pocketbase/url.ts";
import { resolveDashboardAccess } from "../../lib/auth/dashboard-access.ts";
import {
  canSubmitCredentials,
  createLoginRequest,
  isLoginSuccessful,
  LOGIN_ENDPOINT,
  loginFailureMessage,
} from "../../app/login/login-contract.ts";
import { runAfterSessionVerification } from "../../lib/auth/extraction-gate.ts";
import {
  createLogoutRequest,
  isLogoutSuccessful,
  LOGOUT_ENDPOINT,
} from "../../lib/auth/logout-contract.ts";

process.env.SESSION_SIGNING_SECRET = "unit-test-secret-with-at-least-32-bytes";

test("login creates a signed eight-hour absolute deadline", () => {
  const now = 1_800_000_000_000;
  const deadline = createAbsoluteSessionDeadline("test-user", now);
  const cookie = serializeAbsoluteSessionCookie(deadline);

  assert.equal(deadline.issuedAt, now);
  assert.equal(deadline.expiresAt, now + ABSOLUTE_SESSION_MAX_AGE_MS);
  assert.match(cookie, new RegExp(`^${ABSOLUTE_SESSION_COOKIE_NAME}=`));
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Lax/);
  assert.match(cookie, /Path=\//);
});

test("renewal reads the original deadline without extending it", () => {
  const original = createAbsoluteSessionDeadline("test-user", 1_800_000_000_000);
  const renewed = readAbsoluteSessionDeadline(
    `pb_auth=placeholder; ${ABSOLUTE_SESSION_COOKIE_NAME}=${encodeURIComponent(original.value)}`,
    original.issuedAt + 60 * 60 * 1000,
  );

  assert.equal(renewed?.issuedAt, original.issuedAt);
  assert.equal(renewed?.expiresAt, original.expiresAt);
  assert.equal(renewed?.value, original.value);
});

test("deadline expires at eight hours", () => {
  const original = createAbsoluteSessionDeadline("test-user", 1_800_000_000_000);
  const expired = readAbsoluteSessionDeadline(
    `${ABSOLUTE_SESSION_COOKIE_NAME}=${encodeURIComponent(original.value)}`,
    original.expiresAt,
  );

  assert.equal(expired, null);
});

test("a user who becomes inactive is rejected", () => {
  assert.equal(
    classifySessionState(true, { id: "test-user", collectionName: "users", activo: false }, "test-user"),
    "inactive",
  );
});

test("an invalid or expired token is rejected", () => {
  assert.equal(
    classifySessionState(false, { id: "test-user", collectionName: "users", activo: true }, "test-user"),
    "invalid",
  );
  assert.equal(classifyRefreshFailure(401), "invalid");
});

test("PocketBase connection failures remain unavailable, not authenticated", () => {
  assert.equal(classifyRefreshFailure(null), "unavailable");
  assert.equal(classifyRefreshFailure(503), "unavailable");
});

test("a manipulated absolute-deadline cookie fails signature validation", () => {
  const original = createAbsoluteSessionDeadline("test-user", 1_800_000_000_000);
  const altered = `${original.value.slice(0, -1)}x`;

  assert.equal(
    readAbsoluteSessionDeadline(
      `${ABSOLUTE_SESSION_COOKIE_NAME}=${encodeURIComponent(altered)}`,
      original.issuedAt,
    ),
    null,
  );
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

test("login form keeps an empty submission disabled and prevents a duplicate", () => {
  assert.equal(canSubmitCredentials("", "", false), false);
  assert.equal(canSubmitCredentials("user@example.test", "secret", true), false);
  assert.equal(canSubmitCredentials(" user@example.test ", "secret", false), true);
});

test("login request sends only identity and password in a same-origin JSON POST", () => {
  const request = createLoginRequest("user@example.test", "example-password");

  assert.equal(LOGIN_ENDPOINT, "/api/auth/login");
  assert.equal(request.method, "POST");
  assert.equal(request.credentials, "same-origin");
  assert.equal(request.headers["Content-Type"], "application/json");
  assert.deepEqual(JSON.parse(request.body), {
    identity: "user@example.test",
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
    "No fue posible iniciar sesión. Revisa tus datos e inténtalo de nuevo.",
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
  const result = await runAfterSessionVerification(
    async () => ({ authenticated: false, reason: "absent" }),
    () => "unauthorized",
    () => "unavailable",
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

test("inactive extraction sessions are denied before document parsing", async () => {
  let fileReads = 0;
  const result = await runAfterSessionVerification(
    async () => ({ authenticated: false, reason: "inactive" }),
    () => "unauthorized",
    () => "unavailable",
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
  const result = await runAfterSessionVerification(
    async () => {
      throw new Error("simulated PocketBase outage");
    },
    () => "unauthorized",
    () => "unavailable",
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
