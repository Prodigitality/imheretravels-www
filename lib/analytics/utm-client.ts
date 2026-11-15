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
 *
 * Links to the booking form (admin.imheretravels.com/reservation-booking-form)
 * carry them across with `withUtm()`, so a booking is saved with them too.
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

const BOOKING_FORM_PATH = /^\/reservation-booking-form(\/|$)/;

/**
 * Adds the visit's UTMs to a booking-form link. Other links, and links that
 * already carry any UTM (someone tagged them on purpose), are left as they are,
 * so two campaigns never get mixed in one URL.
 */
export function withUtm(href: string): string {
  const utm = getUtm();
  if (!utm || typeof window === "undefined") return href;
  try {
    const url = new URL(href, window.location.href);
    if (!BOOKING_FORM_PATH.test(url.pathname)) return href;
    if (UTM_KEYS.some((key) => url.searchParams.has(key))) return href;
    for (const [key, value] of Object.entries(utm)) {
      if (value) url.searchParams.set(key, value);
    }
    return url.toString();
  } catch {
    return href;
  }
}

/**
 * Rewrites a booking-form link just before the browser follows it: clicks,
 * middle-clicks, and right-click "open in new tab" / "copy link".
 */
export function decorateBookingLinkOnInteraction(event: Event): void {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const link = target.closest("a[href]");
  if (!(link instanceof HTMLAnchorElement)) return;
  const next = withUtm(link.href);
  if (next !== link.href) link.href = next;
}
