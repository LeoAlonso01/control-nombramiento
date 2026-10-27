import test from "node:test";
import assert from "node:assert/strict";
import {
  checkPocketBaseHealth,
  resolvePocketBaseBaseUrl,
} from "../../lib/pocketbase/url.ts";

test("PocketBase URL configuration accepts the HTTPS instance URL", () => {
  const url = resolvePocketBaseBaseUrl(" https://investigacion.tail2a6709.ts.net ");
  assert.equal(url?.origin, "https://investigacion.tail2a6709.ts.net");
});

test("remote PocketBase URLs require HTTPS and must not embed credentials", () => {
  assert.equal(resolvePocketBaseBaseUrl("http://pb.example.invalid"), null);
  assert.equal(resolvePocketBaseBaseUrl("https://user:pass@pb.example.invalid"), null);
  assert.equal(resolvePocketBaseBaseUrl("ftp://pb.example.invalid"), null);
  assert.equal(resolvePocketBaseBaseUrl(undefined), null);
  assert.equal(resolvePocketBaseBaseUrl("http://127.0.0.1:8090")?.hostname, "127.0.0.1");
});

test("health check requests only the fixed health endpoint and accepts HTTP success", async () => {
  let requestedUrl;
  let requestOptions;
  const reachable = await checkPocketBaseHealth(
    "https://investigacion.tail2a6709.ts.net",
    async (url, options) => {
      requestedUrl = url.toString();
      requestOptions = options;
      return new Response(JSON.stringify({ code: 200 }), { status: 200 });
    },
  );

  assert.equal(reachable, true);
  assert.equal(requestedUrl, "https://investigacion.tail2a6709.ts.net/api/health");
  assert.equal(requestOptions.method, "GET");
  assert.equal(requestOptions.redirect, "error");
});

test("health check reports non-success responses as unreachable", async () => {
  const reachable = await checkPocketBaseHealth(
    "https://pocketbase.example.invalid",
    async () => new Response(null, { status: 503 }),
  );
  assert.equal(reachable, false);
});

test("health check handles network and TLS errors without exposing details", async () => {
  const reachable = await checkPocketBaseHealth(
    "https://pocketbase.example.invalid",
    async () => { throw new TypeError("synthetic network failure"); },
  );
  assert.equal(reachable, false);
});

test("health check does not fetch an insecure remote target", async () => {
  let called = false;
  const reachable = await checkPocketBaseHealth(
    "http://pb.example.invalid",
    async () => {
      called = true;
      return new Response(null, { status: 200 });
    },
  );
  assert.equal(reachable, false);
  assert.equal(called, false);
});
