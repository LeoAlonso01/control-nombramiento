export const DECLARATION_TYPES = [
  "inicio",
  "modificacion",
  "conclusion",
  "cambio_dependencia",
  "nota_aclaratoria",
  "otra",
] as const;

export type DeclarationType = (typeof DECLARATION_TYPES)[number];

export const DECLARATION_TYPE_LABELS: Record<DeclarationType, string> = {
  inicio: "Inicio",
  modificacion: "Modificación",
  conclusion: "Conclusión",
  cambio_dependencia: "Cambio de dependencia",
  nota_aclaratoria: "Nota aclaratoria",
  otra: "Otra",
};

export function isDeclarationType(value: unknown): value is DeclarationType {
  return typeof value === "string" &&
    (DECLARATION_TYPES as readonly string[]).includes(value);
}

export type AppointmentExtraction = {
  numero_nombramiento: string | null;
  fecha_emision: string | null;
  lugar_emision: string | null;
  nombre_completo: string | null;
  cargo: string | null;
  departamento: string | null;
  dependencia: string | null;
  fecha_inicio: string | null;
  tipo_nombramiento: string | null;
  observaciones: string[];
};

export type AppointmentEditableFields = {
  numero_nombramiento: string;
  fecha_emision: string;
  lugar_emision: string;
  nombre_funcionario: string;
  cargo: string;
  departamento: string;
  dependencia: string;
  fecha_inicio: string;
  tipo_nombramiento: string;
  observaciones: string;
};

const APPOINTMENT_TEXT_FIELDS = [
  "numero_nombramiento",
  "fecha_emision",
  "lugar_emision",
  "nombre_completo",
  "cargo",
  "departamento",
  "dependencia",
  "fecha_inicio",
  "tipo_nombramiento",
] as const;

const APPOINTMENT_EXPECTED_FIELDS = [
  ...APPOINTMENT_TEXT_FIELDS,
  "observaciones",
] as const;

/** Comprueba una fecha ISO real; no acepta fechas imposibles ni formatos locales. */
export function isValidIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  if (year < 1) return false;

  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(0, 0, 0, 0);

  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
}

/** Valida estrictamente el JSON original de Gemini antes de exponerlo o guardarlo. */
export function validateAppointmentExtraction(
  value: unknown,
): AppointmentExtraction | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  const data = value as Record<string, unknown>;
  const actualFields = Object.keys(data);

  if (
    actualFields.length !== APPOINTMENT_EXPECTED_FIELDS.length ||
    APPOINTMENT_EXPECTED_FIELDS.some((field) => !Object.hasOwn(data, field)) ||
    actualFields.some(
      (field) =>
        !APPOINTMENT_EXPECTED_FIELDS.includes(
          field as (typeof APPOINTMENT_EXPECTED_FIELDS)[number],
        ),
    )
  ) {
    return null;
  }

  if (
    APPOINTMENT_TEXT_FIELDS.some(
      (field) => data[field] !== null && typeof data[field] !== "string",
    )
  ) {
    return null;
  }

  for (const field of ["fecha_emision", "fecha_inicio"] as const) {
    if (data[field] !== null && !isValidIsoDate(data[field])) {
      return null;
    }
  }

  if (
    !Array.isArray(data.observaciones) ||
    !data.observaciones.every((item) => typeof item === "string")
  ) {
    return null;
  }

  return {
    numero_nombramiento: data.numero_nombramiento as string | null,
    fecha_emision: data.fecha_emision as string | null,
    lugar_emision: data.lugar_emision as string | null,
    nombre_completo: data.nombre_completo as string | null,
    cargo: data.cargo as string | null,
    departamento: data.departamento as string | null,
    dependencia: data.dependencia as string | null,
    fecha_inicio: data.fecha_inicio as string | null,
    tipo_nombramiento: data.tipo_nombramiento as string | null,
    observaciones: [...data.observaciones],
  };
}

/** Adapta extracción a campos de revisión sin equiparar las dos fechas distintas. */
export function toAppointmentEditableFields(
  extraction: AppointmentExtraction,
): AppointmentEditableFields {
  return {
    numero_nombramiento: extraction.numero_nombramiento ?? "",
    fecha_emision: extraction.fecha_emision ?? "",
    lugar_emision: extraction.lugar_emision ?? "",
    nombre_funcionario: extraction.nombre_completo ?? "",
    cargo: extraction.cargo ?? "",
    departamento: extraction.departamento ?? "",
    dependencia: extraction.dependencia ?? "",
    fecha_inicio: extraction.fecha_inicio ?? "",
    tipo_nombramiento: extraction.tipo_nombramiento ?? "",
    observaciones: extraction.observaciones.join("\n"),
  };
}
