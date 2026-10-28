import test from "node:test";
import assert from "node:assert/strict";
import {
  listNombramientos,
  NombramientoQueryError,
  parseNombramientoQuery,
} from "../../lib/records/nombramientos.ts";
import { hasPermission } from "../../lib/auth/authorization.ts";
import { classifySessionState } from "../../lib/auth/session-policy.ts";

function fakeClient(responseOrError) {
  const calls = [];
  return {
    calls,
    collection(name) {
      assert.equal(name, "nombramientos");
      return { async getList(page, perPage, options) {
        calls.push({ page, perPage, options });
        if (responseOrError instanceof Error) throw responseOrError;
        return responseOrError;
      } };
    },
  };
}

test("paginates the list and maps only table fields", async () => {
  const client = fakeClient({
    items: [{ id: "fake-id", numero_nombramiento: "TEST-1", datos_ocr: { private: true }, documento: "file.pdf" }],
    page: 2, perPage: 10, totalItems: 11, totalPages: 2,
  });
  const query = parseNombramientoQuery(new URLSearchParams("page=2&perPage=10"));
  const result = await listNombramientos(client, query, "auditor");
  assert.deepEqual([result.page, result.perPage, result.totalItems, result.totalPages], [2, 10, 11, 2]);
  assert.equal(result.items[0].numero_nombramiento, "TEST-1");
  assert.equal("datos_ocr" in result.items[0], false);
  assert.equal("documento" in result.items[0], false);
  assert.equal(client.calls[0].options.filter, 'delete_at = ""');
});

test("accepts only the allowlisted filters and validates pagination parameters", async () => {
  const query = parseNombramientoQuery(new URLSearchParams("page=3&perPage=25&estado_proceso=confirmado&periodo_correspondiente=2025-2026"));
  assert.deepEqual(query, { page: 3, perPage: 25, filters: { estado_proceso: "confirmado", periodo_correspondiente: "2025-2026" } });
  const client = fakeClient({ items: [], page: 3, perPage: 25, totalItems: 0, totalPages: 0 });
  await listNombramientos(client, query, "capturista");
  assert.match(client.calls[0].options.filter, /estado_proceso = "confirmado"/);
  assert.match(client.calls[0].options.filter, /periodo_correspondiente = "2025-2026"/);
  for (const params of ["page=0", "perPage=101", "perPage=0", "unexpected=x", "estado_proceso=otro", "page=1&page=2", "periodo_correspondiente=x%22%20%7C%7C%20true"]) {
    assert.throws(() => parseNombramientoQuery(new URLSearchParams(params)), NombramientoQueryError);
  }
});

test("surfaces network and non-success PocketBase errors without swallowing them", async () => {
  const network = new Error("network unavailable");
  await assert.rejects(listNombramientos(fakeClient(network), parseNombramientoQuery(new URLSearchParams()), "auditor"), network);
  const unauthorized = Object.assign(new Error("request failed"), { status: 401 });
  await assert.rejects(listNombramientos(fakeClient(unauthorized), parseNombramientoQuery(new URLSearchParams()), "auditor"), unauthorized);
});

test("inactive and invalid sessions are rejected by the existing session policy", () => {
  const deadline = { userId: "user-1", expiresAt: Date.now() + 1000 };
  assert.equal(classifySessionState(true, { id: "user-1", collectionName: "users", activo: false }, deadline.userId), "inactive");
  assert.equal(classifySessionState(true, { id: "other-user", collectionName: "users", activo: true }, deadline.userId), "invalid");
  assert.equal(classifySessionState(true, { id: "user-1", collectionName: "users", activo: true }, deadline.userId), "authenticated");
});

test("application roles are checked for read access; unknown roles are denied", () => {
  assert.equal(hasPermission("admin", "nombramientos", "read"), true);
  assert.equal(hasPermission("capturista", "nombramientos", "read"), true);
  assert.equal(hasPermission("auditor", "nombramientos", "read"), true);
  assert.equal(hasPermission("unknown", "nombramientos", "read"), false);
  assert.equal(hasPermission("auditor", "nombramientos", "create"), false);
});

test("logical deletion is always excluded by the repository filter", async () => {
  const client = fakeClient({ items: [], page: 1, perPage: 20, totalItems: 0, totalPages: 0 });
  await listNombramientos(client, parseNombramientoQuery(new URLSearchParams("estado_proceso=pendiente")), "admin");
  assert.match(client.calls[0].options.filter, /delete_at = ""/);
});
