// Ejecutar después de npm run build. PocketBase simulado: no utiliza la instancia configurada.
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { spawn } from "node:child_process";
import { once } from "node:events";

test("ruta de reportes: sesión, permisos, filtros, páginas y fallos sin datos parciales", async () => {
  let role = "auditor";
  let failCollection = false;
  const token = `${Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url")}.${Buffer.from(JSON.stringify({ id: "fixture00000001", exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url")}.fixture`;
  const calls = [];
  const pb = http.createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    res.setHeader("Content-Type", "application/json");
    if (req.headers.authorization !== token) { res.writeHead(401).end(JSON.stringify({ message: "Denied" })); return; }
    if (url.pathname.endsWith("/auth-refresh")) {
      res.end(JSON.stringify({ token, record: { id: "fixture00000001", collectionId: "fixtureusers", collectionName: "users", rol: role } })); return;
    }
    if (url.pathname.endsWith("/records")) {
      calls.push({ path: url.pathname, fields: url.searchParams.get("fields"), filter: url.searchParams.get("filter") });
      if (failCollection && url.pathname.includes("declaraciones")) { res.writeHead(503).end(JSON.stringify({ message: "synthetic_failure" })); return; }
      const collection = url.pathname.includes("nombramientos") ? "nombramientos" : "declaraciones";
      const page = Number(url.searchParams.get("page"));
      const totalPages = collection === "nombramientos" ? 2 : 1;
      res.end(JSON.stringify({ page, perPage: 100, totalItems: totalPages, totalPages, items: [{
        id: `${collection}-${page}`, fecha_recepcion: "2026-11-01 00:00:00.000Z",
        estado_proceso: page === 1 ? "confirmado" : "pendiente", ...(collection === "declaraciones" ? { tipo_declaracion: "inicio" } : {}),
      }] })); return;
    }
    res.writeHead(404).end("{}");
  });
  pb.listen(0, "127.0.0.1"); await once(pb, "listening");
  const portFinder = http.createServer(); portFinder.listen(0, "127.0.0.1"); await once(portFinder, "listening");
  const appPort = portFinder.address().port;
  await new Promise(resolve => portFinder.close(resolve));
  const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(appPort)], {
    cwd: process.cwd(), env: { ...process.env, POCKETBASE_URL: `http://127.0.0.1:${pb.address().port}`, NODE_ENV: "production" },
    stdio: ["ignore", "pipe", "pipe"], windowsHide: true,
  });
  // Se consumen los logs para evitar bloqueo; no se imprimen datos de autenticación.
  child.stdout.resume(); child.stderr.resume();
  const base = `http://127.0.0.1:${appPort}`;
  const cookie = `pb_auth=${encodeURIComponent(JSON.stringify({ token, model: { id: "fixture00000001", collectionName: "users" } }))}`;
  try {
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      try { await fetch(`${base}/api/reportes`); ready = true; break; } catch { await new Promise(resolve => setTimeout(resolve, 100)); }
    }
    assert.equal(ready, true, "servidor de prueba disponible");
    const url = `${base}/api/reportes?desde=2026-11-01&hasta=2026-11-03`;
    const anonymous = await fetch(url);
    assert.equal(anonymous.status, 401); assert.equal(anonymous.headers.get("cache-control"), "no-store");
    role = "desconocido";
    assert.equal((await fetch(url, { headers: { cookie } })).status, 403);
    role = "auditor";
    assert.equal((await fetch(`${base}/api/reportes?desde=2026-02-30&hasta=2026-11-01`, { headers: { cookie } })).status, 400);
    const response = await fetch(url, { headers: { cookie } });
    assert.equal(response.status, 200);
    const report = await response.json();
    assert.equal(report.total, 3); assert.equal(report.nombramientos, 2); assert.equal(report.declaraciones, 1);
    assert.equal(report.rows.length, 3); assert.equal(report.types[0].label, "Inicio");
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.match(response.headers.get("set-cookie"), /HttpOnly/);
    for (const call of calls) { assert.doesNotMatch(call.fields, /nombre|curp|ocr|documento/); assert.match(call.filter, /delete_at/); }
    failCollection = true;
    const failure = await fetch(url, { headers: { cookie } });
    assert.equal(failure.status, 503);
    const body = await failure.json();
    assert.equal("rows" in body, false); assert.equal("total" in body, false);
    assert.doesNotMatch(JSON.stringify(body), /synthetic_failure/);
  } finally {
    child.kill();
    await new Promise(resolve => pb.close(resolve));
  }
});
