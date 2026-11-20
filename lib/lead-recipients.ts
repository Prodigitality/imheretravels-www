/**
 * Who gets the team email for each tour enquiry and contact message.
 *
 * Set in admin → Settings → Email Settings ("Team notification emails"),
 * stored in Firestore `appSettings/teamNotifications` and shared with admin's
 * slot-hold and deposit emails (admin lib/team-recipients.ts, keep the rules
 * in step). bella@ always gets them: the emails go out from her Gmail and she
 * follows up, so a bad or unreadable setting can never drop a lead.
 */

import { adminDb } from "@/lib/firebase-admin";

export const ALWAYS_ON_RECIPIENT = "bella@imheretravels.com";

/** Used until someone saves the setting (agreed 2026-11-20). */
const DEFAULT_RECIPIENTS = [
  { email: ALWAYS_ON_RECIPIENT, enabled: true },
  { email: "jay@imheretravels.com", enabled: true },
];
const MAX_RECIPIENTS = 10;
const EMAIL_RE = /^[^\s@<>",;]+@[^\s@<>",;]+\.[^\s@<>",;]+$/;

/** bella@ plus every enabled, valid, distinct address (at most 10). */
export function enabledLeadEmails(input: unknown): string[] {
  const out = [ALWAYS_ON_RECIPIENT];
  if (!Array.isArray(input)) return out;
  for (const raw of input) {
    const r = raw as { email?: unknown; enabled?: unknown } | null;
    const email = typeof r?.email === "string" ? r.email.trim().toLowerCase() : "";
    if (!email || email.length > 254 || !EMAIL_RE.test(email) || r?.enabled === false) continue;
    if (!out.includes(email) && out.length < MAX_RECIPIENTS) out.push(email);
  }
  return out;
}

/** The To header value for a team email. Never fails: on a read error, bella@ alone. */
export async function leadEmailTo(): Promise<string> {
  try {
    const snap = await adminDb.collection("appSettings").doc("teamNotifications").get();
    return enabledLeadEmails(snap.exists ? snap.get("recipients") : DEFAULT_RECIPIENTS).join(", ");
  } catch (e) {
    console.error("[lead-recipients] read failed, sending to bella@ only", e);
    return ALWAYS_ON_RECIPIENT;
  }
}
