export const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024;

export type DocumentKind = "nombramiento" | "declaracion";

const ALLOWED_MIME_TYPES: Record<DocumentKind, ReadonlySet<string>> = {
  nombramiento: new Set([
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
  ]),
  declaracion: new Set([
    "application/pdf",
    "image/jpeg",
    "image/png",
  ]),
};

export type DocumentMetadataIssue =
  | "empty"
  | "too_large"
  | "unsupported_type"
  | "unsupported_extension";

const ALLOWED_EXTENSIONS: Record<string, ReadonlySet<string>> = {
  "application/pdf": new Set(["pdf"]),
  "image/jpeg": new Set(["jpg", "jpeg"]),
  "image/png": new Set(["png"]),
  "image/webp": new Set(["webp"]),
};

/** Valida metadatos antes de leer el cuerpo completo del archivo. */
export function validateDocumentMetadata(
  size: number,
  mimeType: string,
  kind: DocumentKind,
  fileName?: string,
): DocumentMetadataIssue | null {
  if (size <= 0) return "empty";
  if (size > MAX_DOCUMENT_SIZE) return "too_large";
  if (!ALLOWED_MIME_TYPES[kind].has(mimeType)) return "unsupported_type";
  if (fileName !== undefined) {
    const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
    if (!ALLOWED_EXTENSIONS[mimeType]?.has(extension)) {
      return "unsupported_extension";
    }
  }
  return null;
}

/** Comprueba la firma binaria contra el MIME declarado; la extensión no es confiable. */
export function hasMatchingDocumentSignature(
  mimeType: string,
  bytes: Uint8Array,
): boolean {
  if (mimeType === "application/pdf") {
    return bytes.length >= 5 &&
      bytes[0] === 0x25 && bytes[1] === 0x50 &&
      bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d;
  }

  if (mimeType === "image/jpeg") {
    return bytes.length >= 3 &&
      bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }

  if (mimeType === "image/png") {
    return bytes.length >= 8 &&
      [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
        .every((byte, index) => bytes[index] === byte);
  }

  if (mimeType === "image/webp") {
    return bytes.length >= 12 &&
      bytes[0] === 0x52 && bytes[1] === 0x49 &&
      bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 &&
      bytes[10] === 0x42 && bytes[11] === 0x50;
  }

  return false;
}
