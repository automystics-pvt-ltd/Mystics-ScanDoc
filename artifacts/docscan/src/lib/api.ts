/**
 * Returns the base URL for direct API fetch calls (not via the generated client).
 * Ensures the path ends with a trailing slash so callers can append route segments.
 */
export function getApiUrl(): string {
  const base = import.meta.env.BASE_URL ?? "/";
  return base.endsWith("/") ? `${base}api/` : `${base}/api/`;
}
