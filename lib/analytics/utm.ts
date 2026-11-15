/**
 * UTM parameters from the visitor's landing URL, sent with the enquiry and
 * contact forms so each lead shows which ad or campaign brought it in
 * (requested by the ad agency, 2026-11-15).
 *
 * Shared by the browser (`utm-client.ts` captures them) and the API routes
 * (which re-clean whatever the browser sent, since anyone can post anything).
 */

export const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] as const;

export type UtmKey = (typeof UTM_KEYS)[number];
export type Utm = Partial<Record<UtmKey, string>>;

const MAX_LENGTH = 150;

/** Keeps only the five UTM keys, as trimmed non-empty strings. Null when none are left. */
export function cleanUtm(input: unknown): Utm | null {
  if (!input || typeof input !== "object") return null;
  const source = input as Record<string, unknown>;
  const out: Utm = {};
  for (const key of UTM_KEYS) {
    const value = source[key];
    if (typeof value !== "string") continue;
    const trimmed = value.trim().slice(0, MAX_LENGTH);
    if (trimmed) out[key] = trimmed;
  }
  return Object.keys(out).length > 0 ? out : null;
}

/** `[key, value]` pairs for the team email, in the standard UTM order. */
export function utmRows(utm: Utm | null): [string, string][] {
  if (!utm) return [];
  return UTM_KEYS.filter((key) => utm[key]).map((key) => [key, utm[key] as string]);
}
