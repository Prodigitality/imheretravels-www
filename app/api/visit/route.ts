import { createHash } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { cleanUtm } from "@/lib/analytics/utm";

/**
 * Cookie-free visit counter (requested by the ad agency, 2026-11-26).
 *
 * Meta and GA4 only see visitors who accept cookies, so neither shows how many
 * people the ads actually bring to the sale page. `VisitCounter` (root layout)
 * posts here on page changes, whatever the cookie choice: it sets no cookies
 * and stores nothing on the device.
 *
 * Only hourly totals are kept: one `siteVisitStats` doc per UTC hour, UTM
 * source and UTM campaign, holding counters. No IP address, user agent, URL or
 * other per-visitor detail is stored. Hours let a report cut days in any time
 * zone; `day` is the Manila date, because the Meta ad account (and GA4) report
 * in Manila time. Docs written before 27 Nov 2026 have no `hour` and a UK-time
 * `day` (admin's Website visits report explains those two days).
 *
 * Counters (a "visit" is one page load; moving between pages without a reload
 * stays in the same visit):
 * - visits:          visits, on any page
 * - saleVisits:      visits that viewed the sale page
 * - saleThenTour:    of those, visits that went on to open a tour page
 * - saleSeconds / saleTimed: total seconds on the sale page and the number of
 *   visits timed, so average time = saleSeconds / saleTimed
 *
 * Writes happen only on Vercel production; elsewhere the update is logged.
 */

export const dynamic = "force-dynamic";

const COLLECTION = "siteVisitStats";
const EVENTS = ["visit", "sale", "sale_tour", "sale_time"] as const;
type VisitEvent = (typeof EVENTS)[number];
const MAX_SECONDS = 30 * 60;
const BOT_UA = /bot|crawl|spider|slurp|preview|headless|lighthouse|pingdom|monitor|facebookexternalhit/i;

const noContent = () => new Response(null, { status: 204 });

/** Only count posts made by our own pages. */
function fromOurSite(request: Request): boolean {
  const origin = request.headers.get("origin") ?? request.headers.get("referer") ?? "";
  try {
    const host = new URL(origin).hostname;
    return host === "imheretravels.com" || host.endsWith(".imheretravels.com") || host === "localhost";
  } catch {
    return false;
  }
}

function manilaDay(date: Date): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(date);
}

export async function POST(request: Request) {
  if (!fromOurSite(request)) return noContent();
  if (BOT_UA.test(request.headers.get("user-agent") ?? "")) return noContent();

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return noContent();
  }
  const event = body.e as VisitEvent;
  if (!EVENTS.includes(event)) return noContent();

  const utm = cleanUtm(body.utm);
  const source = (utm?.utm_source ?? "(none)").toLowerCase().slice(0, 60);
  const campaign = (utm?.utm_campaign ?? "(none)").slice(0, 100);

  const update: Record<string, FieldValue> = {};
  if (event === "visit") update.visits = FieldValue.increment(1);
  if (event === "sale") update.saleVisits = FieldValue.increment(1);
  if (event === "sale_tour") update.saleThenTour = FieldValue.increment(1);
  if (event === "sale_time") {
    const seconds = Math.round(Number(body.s));
    if (!Number.isFinite(seconds) || seconds <= 0) return noContent();
    update.saleSeconds = FieldValue.increment(Math.min(seconds, MAX_SECONDS));
    if (body.first === true) update.saleTimed = FieldValue.increment(1);
  }

  const now = new Date();
  const hour = now.toISOString().slice(0, 13); // UTC hour, e.g. 2026-11-27T05
  const day = manilaDay(now);
  const key = createHash("sha1").update(`${source}\n${campaign}`).digest("hex").slice(0, 16);
  const docId = `h_${hour}_${key}`;

  if (process.env.VERCEL_ENV !== "production") {
    console.log("[visit] would count", docId, { hour, day, source, campaign, event, s: body.s, first: body.first });
    return noContent();
  }

  try {
    // Imported here so the route loads without credentials outside production.
    const { adminDb } = await import("@/lib/firebase-admin");
    await adminDb
      .collection(COLLECTION)
      .doc(docId)
      .set(
        {
          hour,
          day,
          timeZone: "Asia/Manila",
          source,
          campaign,
          ...update,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
  } catch (error) {
    console.error("[visit] count failed", error);
  }
  return noContent();
}
