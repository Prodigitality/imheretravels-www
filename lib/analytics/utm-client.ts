import { CONSENT_COOKIE } from "@/app/components/global/consent";
import { cleanUtm, UTM_KEYS, type Utm } from "@/lib/analytics/utm";

/**
 * Browser side of UTM capture. `UtmCapture` (root layout) reads the landing
 * URL once; the forms call `getUtm()` when they submit.
 *
 * The values live in memory, which is enough here: Next.js moves between pages
 * without reloading, so the landing page's UTMs are still there when the form
 * is sent. Memory needs no consent. They are also copied to sessionStorage, so
 * they survive a reload, but only when the visitor has accepted cookies.
 */

const STORAGE_KEY = "iht_utm";

let captured: Utm | null = null;

function hasConsent(): boolean {
  try {
    return document.cookie.split("; ").includes(`${CONSENT_COOKIE}=granted`);
  } catch {
    return false;
  }
}

/** Reads UTMs from the current URL. A URL without any leaves earlier ones in place. */
export function captureUtmFromUrl(): void {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  const fromUrl = cleanUtm(Object.fromEntries(UTM_KEYS.map((key) => [key, params.get(key)])));
  if (!fromUrl) return;
  captured = fromUrl;
  if (!hasConsent()) return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(fromUrl));
  } catch {
    // Storage blocked: memory still has them.
  }
}

/** The visit's UTMs, or null for a visitor who didn't arrive from a tagged link. */
export function getUtm(): Utm | null {
  if (typeof window === "undefined") return null;
  if (captured) return captured;
  try {
    if (!hasConsent()) {
      window.sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    const stored = window.sessionStorage.getItem(STORAGE_KEY);
    return stored ? cleanUtm(JSON.parse(stored)) : null;
  } catch {
    return null;
  }
}
