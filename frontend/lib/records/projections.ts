import type { AppRole } from "../auth/authorization.ts";

type RecordData = Record<string, unknown>;

type NombramientoIdentity = {
  id: string;
  uuid: string | null;
  numero_nombramiento: string | null;
  nombre_funcionario: string | null;
  cargo: string | null;
  fecha_nombramiento: string | null;
  periodo_correspondiente: string | null;
  fecha_recepcion: string | null;
  estado_ocr: string | null;
  estado_proceso: string | null;
};

export type NombramientoAuditorDTO = NombramientoIdentity & { role: "auditor" };
export type NombramientoCapturistaDTO = NombramientoIdentity & {
  role: "capturista";
  observaciones: string | null;
  datos_ocr: unknown;
};
export type NombramientoAdminDTO = NombramientoIdentity & {
  role: "admin";
  observaciones: string | null;
  datos_ocr: unknown;
};
export type NombramientoDTO =
  | NombramientoAuditorDTO
  | NombramientoCapturistaDTO
  | NombramientoAdminDTO;

type DeclaracionIdentity = {
  id: string;
  uuid: string | null;
  nombre_declarante: string | null;
  fecha: string | null;
  tipo_declaracion: string | null;
  fecha_recepcion: string | null;
  periodo_correspondiente: string | null;
  lugar_declaracion: string | null;
  estado_proceso: string | null;
};

export type DeclaracionAuditorDTO = DeclaracionIdentity & { role: "auditor" };
export type DeclaracionCapturistaDTO = DeclaracionIdentity & {
  role: "capturista";
  curp_declarante: string | null;
  observaciones: string | null;
  datos_ocr: unknown;
};
export type DeclaracionAdminDTO = DeclaracionIdentity & {
  role: "admin";
  curp_declarante: string | null;
  observaciones: string | null;
  datos_ocr: unknown;
};
export type DeclaracionDTO =
  | DeclaracionAuditorDTO
  | DeclaracionCapturistaDTO
  | DeclaracionAdminDTO;

function text(record: RecordData, key: string): string | null {
  return typeof record[key] === "string" ? record[key] as string : null;
}

function json(record: RecordData, key: string): unknown {
  return Object.hasOwn(record, key) ? record[key] : null;
}

/** Construye una allowlist por rol; no serializa el registro PocketBase completo. */
export function projectNombramiento(
  role: AppRole,
  source: RecordData,
): NombramientoDTO {
  const identity: NombramientoIdentity = {
    id: text(source, "id") ?? "",
    uuid: text(source, "uuid"),
    numero_nombramiento: text(source, "numero_nombramiento"),
    nombre_funcionario: text(source, "nombre_funcionario"),
    cargo: text(source, "cargo"),
    fecha_nombramiento: text(source, "fecha_nombramiento"),
    periodo_correspondiente: text(source, "periodo_correspondiente"),
    fecha_recepcion: text(source, "fecha_recepcion"),
    estado_ocr: text(source, "estado_ocr"),
    estado_proceso: text(source, "estado_proceso"),
  };

  if (role === "auditor") return { role, ...identity };
  const sensitive = { observaciones: text(source, "observaciones"), datos_ocr: json(source, "datos_ocr") };
  return { role, ...identity, ...sensitive };
}

/** El DTO auditor contiene identificación y estado, nunca CURP, OCR ni referencias a archivos. */
export function projectDeclaracion(
  role: AppRole,
  source: RecordData,
): DeclaracionDTO {
  const identity: DeclaracionIdentity = {
    id: text(source, "id") ?? "",
    uuid: text(source, "uuid"),
    nombre_declarante: text(source, "nombre_declarante"),
    fecha: text(source, "fecha"),
    tipo_declaracion: text(source, "tipo_declaracion"),
    fecha_recepcion: text(source, "fecha_recepcion"),
    periodo_correspondiente: text(source, "periodo_correspondiente"),
    lugar_declaracion: text(source, "lugar_declaracion"),
    estado_proceso: text(source, "estado_proceso"),
  };

  if (role === "auditor") return { role, ...identity };
  const sensitive = {
    curp_declarante: text(source, "curp_declarante"),
    observaciones: text(source, "observaciones"),
    datos_ocr: json(source, "datos_ocr"),
  };
  return { role, ...identity, ...sensitive };
}
