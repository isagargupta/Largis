export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

/** Keeps search text safe inside a PostgREST `or=(...)` filter. */
export function cleanQuery(value: unknown) {
  return typeof value === "string"
    ? value
        .replace(/[^\p{L}\p{N}@.\-_' ]/gu, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 80)
    : "";
}

/** A search param restricted to known values. */
export function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

export function daysAgoIso(days: number, now = Date.now()) {
  return new Date(now - days * 86_400_000).toISOString();
}
