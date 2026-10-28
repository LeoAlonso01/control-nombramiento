import test from "node:test";
import assert from "node:assert/strict";
import { projectDeclaracion, projectNombramiento } from "../../lib/records/projections.ts";
import { authorizeRecordOperation } from "../../lib/auth/record-authorization.ts";

const syntheticDeclaration = {
  id: "fake-declaration-id",
  uuid: "fake-uuid",
  nombre_declarante: "Persona Ficticia",
  fecha: "2025-02-03",
  tipo_declaracion: "inicio",
  fecha_recepcion: "2025-02-04",
  periodo_correspondiente: "2025",
  lugar_declaracion: "Lugar de prueba",
  estado_proceso: "pendiente",
  curp_declarante: "CURP-FICTICIA-0000",
  datos_ocr: { texto: "OCR sintético", curp: "CURP-FICTICIA-0000" },
  documento: "original-sintetico.pdf",
  documento_name: "original-sintetico.pdf",
  fileToken: "fake-file-token",
  documento_url: "https://example.invalid/original-sintetico.pdf",
  observaciones: "Observación sintética",
  extra: "no debe proyectarse",
};

const authenticated = (role) => ({
  authenticated: true,
  user: { id: "fake-user-id", role },
});

test("auditor declaration DTO contains identity and status but excludes sensitive fields", () => {
  const dto = projectDeclaracion("auditor", syntheticDeclaration);
  assert.equal(dto.nombre_declarante, "Persona Ficticia");
  assert.equal(dto.estado_proceso, "pendiente");
  for (const forbidden of [
    "curp_declarante", "datos_ocr", "documento", "documento_name",
    "fileToken", "documento_url", "observaciones", "extra",
  ]) assert.equal(Object.hasOwn(dto, forbidden), false, forbidden);
  const serialized = JSON.stringify(dto);
  for (const secret of ["CURP-FICTICIA", "OCR sintético", "fake-file-token", "original-sintetico.pdf", "example.invalid"]) {
    assert.equal(serialized.includes(secret), false, secret);
  }
});

test("admin and capturista receive separate DTO variants while file metadata stays excluded", () => {
  for (const role of ["admin", "capturista"]) {
    const dto = projectDeclaracion(role, syntheticDeclaration);
    assert.equal(dto.role, role);
    assert.equal(dto.curp_declarante, "CURP-FICTICIA-0000");
    assert.deepEqual(dto.datos_ocr, syntheticDeclaration.datos_ocr);
    for (const forbidden of ["documento", "documento_name", "fileToken", "documento_url"]) {
      assert.equal(Object.hasOwn(dto, forbidden), false, `${role}: ${forbidden}`);
    }
  }
});

test("auditor appointment DTO includes identity and status without OCR, CURP, or file references", () => {
  const dto = projectNombramiento("auditor", {
    id: "fake-appointment-id",
    numero_nombramiento: "NOM-SINTETICO-01",
    nombre_funcionario: "Persona Ficticia",
    cargo: "Cargo de prueba",
    estado_ocr: "revision_manual",
    estado_proceso: "pendiente",
    curp: "CURP-FICTICIA-0000",
    datos_ocr: { texto: "OCR sintético" },
    documento: "original-sintetico.pdf",
    fileToken: "fake-file-token",
    url: "https://example.invalid/file",
  });
  assert.equal(dto.numero_nombramiento, "NOM-SINTETICO-01");
  assert.equal(dto.estado_proceso, "pendiente");
  for (const forbidden of ["curp", "datos_ocr", "documento", "fileToken", "url", "observaciones"]) {
    assert.equal(Object.hasOwn(dto, forbidden), false, forbidden);
  }
});

test("admin and capturista appointment DTOs are discriminated and omit file locations", () => {
  for (const role of ["admin", "capturista"]) {
    const dto = projectNombramiento(role, {
      id: "fake-appointment-id", estado_proceso: "pendiente",
      datos_ocr: { propuesta: "OCR sintético" }, documento: "original-sintetico.pdf",
      fileToken: "fake-file-token", url: "https://example.invalid/file",
    });
    assert.equal(dto.role, role);
    assert.deepEqual(dto.datos_ocr, { propuesta: "OCR sintético" });
    for (const forbidden of ["documento", "fileToken", "url"]) assert.equal(Object.hasOwn(dto, forbidden), false);
  }
});

test("inactive and invalid sessions cannot perform record operations", async () => {
  for (const session of [{ authenticated: false }, { authenticated: false, reason: "invalid" }]) {
    const result = await authorizeRecordOperation(session, "declaraciones", "read");
    assert.deepEqual(result, { allowed: false, reason: "unauthenticated" });
  }
});

test("the role matrix authorizes only approved operations", async () => {
  const cases = [
    ["admin", "read", true], ["admin", "create", true], ["admin", "correct", true],
    ["admin", "confirm", true], ["admin", "reject", true], ["admin", "read_document", true],
    ["admin", "soft_delete", true], ["admin", "restore", true], ["admin", "hard_delete", false],
    ["capturista", "read", true], ["capturista", "create", true], ["capturista", "correct", true],
    ["capturista", "confirm", false], ["capturista", "reject", false], ["capturista", "read_document", true],
    ["capturista", "soft_delete", false], ["capturista", "restore", false], ["capturista", "hard_delete", false],
    ["auditor", "read", true], ["auditor", "create", false], ["auditor", "correct", false],
    ["auditor", "confirm", false], ["auditor", "reject", false], ["auditor", "read_document", false],
    ["auditor", "soft_delete", false], ["auditor", "restore", false], ["auditor", "hard_delete", false],
  ];
  for (const [role, operation, expected] of cases) {
    const result = await authorizeRecordOperation(
      authenticated(role), "nombramientos", operation, "fake-record-id",
      async (id) => ({ id, estado: "revision_manual" }),
    );
    assert.equal(result.allowed, expected, `${role} ${operation}`);
  }
});

test("capturista can correct any non-final state using the server-loaded current record", async () => {
  for (const estado of ["pendiente", "procesando", "revision_manual", "error"]) {
    let loadedId;
    const result = await authorizeRecordOperation(
      authenticated("capturista"), "nombramientos", "correct", "fake-record-id",
      async (recordId) => { loadedId = recordId; return { id: "fake-record-id", estado }; },
    );
    assert.deepEqual(result, { allowed: true, recordId: "fake-record-id" });
    assert.equal(loadedId, "fake-record-id");
  }
});

test("correction is denied for confirmed/rejected records even if the client claims a draft state", async () => {
  for (const estado of ["confirmado", "rechazado"]) {
    const bodyClaimedState = "pendiente";
    const result = await authorizeRecordOperation(
      authenticated("capturista"), "declaraciones", "correct", "fake-record-id",
      async () => ({ id: "fake-record-id", estado }),
    );
    assert.notEqual(bodyClaimedState, estado);
    assert.deepEqual(result, { allowed: false, reason: "final_state" });
  }
});

test("confirm and reject require admin and a transition allowed from the current stored state", async () => {
  const load = async (estado) => async (id) => ({ id, estado });
  assert.deepEqual(
    await authorizeRecordOperation(authenticated("admin"), "nombramientos", "confirm", "fake-id", await load("revision_manual")),
    { allowed: true, recordId: "fake-id" },
  );
  assert.deepEqual(
    await authorizeRecordOperation(authenticated("admin"), "nombramientos", "reject", "fake-id", await load("revision_manual")),
    { allowed: true, recordId: "fake-id" },
  );
  assert.deepEqual(
    await authorizeRecordOperation(authenticated("admin"), "nombramientos", "confirm", "fake-id", await load("pendiente")),
    { allowed: false, reason: "invalid_state" },
  );
  assert.deepEqual(
    await authorizeRecordOperation(authenticated("capturista"), "nombramientos", "confirm", "fake-id", await load("revision_manual")),
    { allowed: false, reason: "forbidden" },
  );
});

test("unknown stored states, missing records, loader errors, and hard-delete requests fail closed", async () => {
  const load = async (estado) => async (id) => ({ id, estado });
  assert.deepEqual(
    await authorizeRecordOperation(authenticated("capturista"), "nombramientos", "correct", "fake-id", await load("unexpected")),
    { allowed: false, reason: "invalid_state" },
  );
  assert.deepEqual(
    await authorizeRecordOperation(authenticated("capturista"), "nombramientos", "correct", "fake-id", async () => null),
    { allowed: false, reason: "missing_record" },
  );
  assert.deepEqual(
    await authorizeRecordOperation(authenticated("admin"), "nombramientos", "correct", "fake-id", async () => { throw new Error("synthetic failure"); }),
    { allowed: false, reason: "unavailable" },
  );
  assert.deepEqual(
    await authorizeRecordOperation(authenticated("admin"), "nombramientos", "hard_delete", "fake-id", async () => ({ id: "fake-id", estado: "pendiente" })),
    { allowed: false, reason: "forbidden" },
  );
});
