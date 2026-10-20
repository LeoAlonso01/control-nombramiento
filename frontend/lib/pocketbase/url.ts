/** Acepta únicamente URL HTTP(S) sin credenciales embebidas, consulta ni fragmento. */
export function parsePocketBaseUrl(value: string): URL | null {
  try {
    const url = new URL(value);

    if (
      (url.protocol !== "http:" && url.protocol !== "https:") ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      return null;
    }

    return url;
  } catch {
    return null;
  }
}
