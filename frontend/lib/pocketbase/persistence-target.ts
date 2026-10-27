export type PersistenceEnvironment = "development" | "production";

export type PersistenceTarget = {
  environment: PersistenceEnvironment;
  url: URL;
};

export class PersistenceTargetConfigurationError extends Error {
  constructor() {
    super("PocketBase persistence target configuration is missing or unsafe.");
    this.name = "PersistenceTargetConfigurationError";
  }
}

type PersistenceTargetEnvironment = Record<string, string | undefined>;

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

function parseSafeUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    if (
      (url.protocol !== "http:" && url.protocol !== "https:") ||
      url.username || url.password || url.search || url.hash
    ) return null;
    return url;
  } catch {
    return null;
  }
}

/**
 * Selects a deliberately separate persistence target. Development persistence
 * is restricted to a local PocketBase process until an isolated remote instance
 * has an independently verifiable identity and an approved configuration.
 */
export function resolvePersistenceTarget(
  variables: PersistenceTargetEnvironment,
): PersistenceTarget {
  const target = variables.POCKETBASE_PERSISTENCE_ENV;
  const runtime = variables.NODE_ENV;

  if (
    (target !== "development" && target !== "production") ||
    (runtime === "production" && target !== "production") ||
    (runtime !== "production" && target !== "development")
  ) {
    throw new PersistenceTargetConfigurationError();
  }

  const configuredUrl = target === "development"
    ? variables.POCKETBASE_DEVELOPMENT_URL
    : variables.POCKETBASE_PRODUCTION_URL;
  const parsedUrl = configuredUrl ? parseSafeUrl(configuredUrl) : null;

  if (!parsedUrl) throw new PersistenceTargetConfigurationError();

  const isLoopback = LOOPBACK_HOSTS.has(parsedUrl.hostname.toLowerCase());
  if (
    (target === "development" && (!isLoopback || parsedUrl.protocol !== "http:")) ||
    (target === "production" && (isLoopback || parsedUrl.protocol !== "https:"))
  ) {
    throw new PersistenceTargetConfigurationError();
  }

  const otherUrl = target === "development"
    ? variables.POCKETBASE_PRODUCTION_URL
    : variables.POCKETBASE_DEVELOPMENT_URL;
  if (otherUrl) {
    const parsedOtherUrl = parseSafeUrl(otherUrl);
    if (!parsedOtherUrl || parsedOtherUrl.origin === parsedUrl.origin) {
      throw new PersistenceTargetConfigurationError();
    }
  }

  return { environment: target, url: parsedUrl };
}
