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

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** Exige HTTPS para destinos remotos; HTTP queda limitado a PocketBase local. */
export function resolvePocketBaseBaseUrl(value: string | undefined): URL | null {
  if (!value?.trim()) return null;

  const url = parsePocketBaseUrl(value.trim());
  if (!url) return null;

  const isLoopback = LOOPBACK_HOSTS.has(url.hostname.toLowerCase());
  if (url.protocol !== "https:" && !(url.protocol === "http:" && isLoopback)) {
    return null;
  }

  return url;
}

/** Consulta solo el endpoint fijo de salud y convierte cualquier fallo de red en false. */
export async function checkPocketBaseHealth(
  configuredUrl: string | undefined,
  fetcher: typeof fetch = fetch,
): Promise<boolean> {
  const baseUrl = resolvePocketBaseBaseUrl(configuredUrl);
  if (!baseUrl) return false;

  try {
    const response = await fetcher(new URL("/api/health", baseUrl), {
      method: "GET",
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(5_000),
    });
    return response.ok;
  } catch {
    return false;
  }
}
