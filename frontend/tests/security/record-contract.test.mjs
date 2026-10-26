import test from "node:test";
import assert from "node:assert/strict";
import {
  DECLARATION_TYPES,
  isDeclarationType,
  isValidIsoDate,
  toAppointmentEditableFields,
  validateAppointmentExtraction,
} from "../../lib/records/contracts.ts";
import {
  hasMatchingDocumentSignature,
  MAX_DOCUMENT_SIZE,
  validateDocumentMetadata,
} from "../../lib/files/document-validation.ts";
import { canTransitionExpediente } from "../../lib/records/workflow.ts";

const appointmentExtraction = {
  numero_nombramiento: "N-24",
  fecha_emision: "2024-02-29",
  lugar_emision: "Ciudad de México",
  nombre_completo: "Nombre de prueba",
  cargo: "Cargo de prueba",
  departamento: "Departamento de prueba",
  dependencia: "Dependencia de prueba",
  fecha_inicio: "2024-03-01",
  tipo_nombramiento: "Tipo de prueba",
  observaciones: ["Primera nota", "Segunda nota"],
};

test("accepts real ISO calendar dates and rejects impossible dates", () => {
  assert.equal(isValidIsoDate("2024-02-29"), true);
  assert.equal(isValidIsoDate("0001-01-01"), true);
  assert.equal(isValidIsoDate("2023-02-29"), false);
  assert.equal(isValidIsoDate("2024-13-01"), false);
  assert.equal(isValidIsoDate("01/02/2024"), false);
});

test("validates the exact original appointment extraction contract", () => {
  assert.deepEqual(
    validateAppointmentExtraction(appointmentExtraction),
    appointmentExtraction,
  );
  assert.equal(
    validateAppointmentExtraction({ ...appointmentExtraction, extra: "no" }),
    null,
  );
  assert.equal(
    validateAppointmentExtraction({
      ...appointmentExtraction,
      fecha_emision: "2024-02-30",
    }),
    null,
  );
  assert.equal(
    validateAppointmentExtraction({
      ...appointmentExtraction,
      observaciones: ["válida", 1],
    }),
    null,
  );
});

test("maps Gemini's name to editable nombre_funcionario and keeps dates distinct", () => {
  const originalObservations = [...appointmentExtraction.observaciones];
  const extraction = validateAppointmentExtraction(appointmentExtraction);
  assert.ok(extraction);

  const editable = toAppointmentEditableFields(extraction);

  assert.equal(editable.nombre_funcionario, "Nombre de prueba");
  assert.equal(editable.fecha_emision, "2024-02-29");
  assert.equal("fecha_nombramiento" in editable, false);
  assert.equal(editable.fecha_inicio, "2024-03-01");
  assert.equal(editable.observaciones, "Primera nota\nSegunda nota");
  assert.deepEqual(extraction.observaciones, originalObservations);
});

test("declaration contract exposes exactly the six approved reference types", () => {
  assert.deepEqual(DECLARATION_TYPES, [
    "inicio",
    "modificacion",
    "conclusion",
    "cambio_dependencia",
    "nota_aclaratoria",
    "otra",
  ]);
  assert.equal(DECLARATION_TYPES.includes("otra"), true);
  assert.equal(DECLARATION_TYPES.includes("desconocida"), false);
  assert.equal(isDeclarationType("cambio_dependencia"), true);
  assert.equal(isDeclarationType("desconocida"), false);
});

test("file metadata validation rejects empty, oversized, and unsupported uploads", () => {
  assert.equal(validateDocumentMetadata(0, "application/pdf", "nombramiento"), "empty");
  assert.equal(
    validateDocumentMetadata(MAX_DOCUMENT_SIZE + 1, "application/pdf", "nombramiento"),
    "too_large",
  );
  assert.equal(
    validateDocumentMetadata(MAX_DOCUMENT_SIZE, "application/pdf", "nombramiento"),
    null,
  );
  assert.equal(
    validateDocumentMetadata(1024, "image/webp", "declaracion"),
    "unsupported_type",
  );
  assert.equal(
    validateDocumentMetadata(1024, "application/pdf", "nombramiento", "archivo.pdf"),
    null,
  );
  assert.equal(
    validateDocumentMetadata(1024, "application/pdf", "nombramiento", "archivo.png"),
    "unsupported_extension",
  );
});

test("file signatures must match the declared MIME type", () => {
  assert.equal(
    hasMatchingDocumentSignature("application/pdf", new TextEncoder().encode("%PDF-1.7")),
    true,
  );
  assert.equal(
    hasMatchingDocumentSignature(
      "image/jpeg",
      new Uint8Array([0xff, 0xd8, 0xff, 0x00]),
    ),
    true,
  );
  assert.equal(
    hasMatchingDocumentSignature(
      "image/png",
      new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    ),
    true,
  );
  assert.equal(
    hasMatchingDocumentSignature(
      "image/webp",
      new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]),
    ),
    true,
  );
  assert.equal(
    hasMatchingDocumentSignature("application/pdf", new Uint8Array([0xff, 0xd8, 0xff])),
    false,
  );
  assert.equal(hasMatchingDocumentSignature("image/gif", new Uint8Array([0x47, 0x49, 0x46])), false);
});

test("expediente transitions allow review, final decisions, and error retries only", () => {
  assert.equal(canTransitionExpediente("pendiente", "procesando"), true);
  assert.equal(canTransitionExpediente("procesando", "revision_manual"), true);
  assert.equal(canTransitionExpediente("procesando", "error"), true);
  assert.equal(canTransitionExpediente("error", "procesando"), true);
  assert.equal(canTransitionExpediente("revision_manual", "confirmado"), true);
  assert.equal(canTransitionExpediente("revision_manual", "rechazado"), true);

  assert.equal(canTransitionExpediente("pendiente", "confirmado"), false);
  assert.equal(canTransitionExpediente("revision_manual", "procesando"), false);
  assert.equal(canTransitionExpediente("confirmado", "rechazado"), false);
  assert.equal(canTransitionExpediente("rechazado", "procesando"), false);
});
