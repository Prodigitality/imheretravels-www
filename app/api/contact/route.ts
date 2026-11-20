/**
 * POST /api/contact: the /contact-us form.
 *
 * Flow: honeypot → validate → rate limit → Firestore `enquiries` (saved first,
 * same list as the tour "Inquire now" form, admin → Enquiries) → branded email
 * to the team (lib/lead-recipients.ts) and a receipt to the customer
 * (lib/lead-emails.ts) → optional Mailchimp opt-in.
 *
 * Local dev saves to the dev Firestore but doesn't email anyone or touch
 * Mailchimp unless ENQUIRY_SIDE_EFFECTS_IN_DEV=1 (same switch as /api/enquiry).
 */

import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { getGmailAccessToken, sendGmail } from "@/lib/gmail";
import { subscribeToMailchimp } from "@/lib/mailchimp";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { cleanUtm } from "@/lib/analytics/utm";
import { normalizePhone } from "@/lib/phone";
import { buildLeadCustomerEmail, buildLeadTeamEmail, type LeadSummary } from "@/lib/lead-emails";
import { leadEmailTo } from "@/lib/lead-recipients";

export const runtime = "nodejs";

const RATE_COLLECTION = "enquiryRateLimits";
const LIMIT_PER_IP = { name: "contact-ip", max: 8, windowMs: 60 * 60_000 };
const LIMIT_PER_EMAIL = { name: "contact-email", max: 5, windowMs: 60 * 60_000 };
const SIDE_EFFECTS =
  process.env.NODE_ENV === "production" || process.env.ENQUIRY_SIDE_EFFECTS_IN_DEV === "1";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type ContactPayload = {
  firstName?: unknown;
  lastName?: unknown;
  email?: unknown;
  phone?: unknown;
  message?: unknown;
  subscribe?: unknown;
  acceptedPrivacy?: unknown;
  /** UTM parameters from the visitor's landing URL (lib/analytics/utm.ts). */
  utm?: unknown;
  /** Honeypot. */
  website?: unknown;
};

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function POST(request: Request) {
  let payload: ContactPayload;
  try {
    payload = (await request.json()) as ContactPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  // Bots fill every field; pretend success, store and send nothing.
  if (str(payload.website, 200)) return NextResponse.json({ ok: true });

  const firstName = str(payload.firstName, 100);
  const lastName = str(payload.lastName, 100);
  const email = str(payload.email, 200).toLowerCase();
  const phoneRaw = str(payload.phone, 50);
  const message = str(payload.message, 5000);
  const subscribe = payload.subscribe === true;

  if (!firstName || !lastName || !email || !phoneRaw || !message) {
    return NextResponse.json({ error: "All fields are required." }, { status: 400 });
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }

  // Full international number (the form's country picker adds the code), so
  // the team can follow up on WhatsApp.
  const phoneParsed = normalizePhone(phoneRaw);
  if (!phoneParsed) {
    return NextResponse.json(
      { error: "Please enter your phone number with its country code, e.g. +44 7911 123456." },
      { status: 400 },
    );
  }
  const phone = phoneParsed.e164;

  if (payload.acceptedPrivacy !== true) {
    return NextResponse.json({ error: "You must accept the privacy policy." }, { status: 400 });
  }

  // The customer now gets a receipt, so cap how often one sender can trigger it.
  const ip = clientIp(request);
  const retryIp = await checkRateLimit(RATE_COLLECTION, LIMIT_PER_IP, ip);
  const retryEmail = retryIp ? null : await checkRateLimit(RATE_COLLECTION, LIMIT_PER_EMAIL, email);
  if (retryIp ?? retryEmail) {
    return NextResponse.json(
      { error: "You've sent several messages in a short time. Please try again later, or email bella@imheretravels.com." },
      { status: 429 },
    );
  }

  const fullName = `${firstName} ${lastName}`.trim();
  const utm = cleanUtm(payload.utm);

  // Saved first, so a message is never lost to a Gmail outage.
  const ref = adminDb.collection("enquiries").doc();
  let saved = false;
  try {
    await ref.set({
      status: "new",
      firstName,
      lastName,
      name: fullName,
      nameLower: fullName.toLowerCase(),
      email,
      phone,
      message,
      tour: null,
      subscribe,
      consent: {
        agreed: true,
        at: FieldValue.serverTimestamp(),
        privacyPolicyUrl: "https://www.imheretravels.com/privacy-policy",
      },
      source: {
        form: "contact_us",
        location: null,
        page: (request.headers.get("referer") ?? "").slice(0, 300),
        userAgent: (request.headers.get("user-agent") ?? "").slice(0, 300),
        utm,
      },
      emails: { team: "pending" },
      mailchimp: subscribe ? "pending" : "not_requested",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    saved = true;
  } catch (err) {
    console.error("Contact form: Firestore save failed:", err);
  }

  let team = SIDE_EFFECTS ? "failed" : "skipped_dev";
  let customer = SIDE_EFFECTS ? "failed" : "skipped_dev";
  let mailchimp = subscribe ? (SIDE_EFFECTS ? "failed" : "skipped_dev") : "not_requested";
  if (SIDE_EFFECTS) {
    const lead: LeadSummary = {
      id: saved ? ref.id : "",
      form: "contact_us",
      firstName,
      fullName,
      email,
      phoneDisplay: phoneParsed.display,
      phoneE164: phone,
      message,
      subscribe,
      utm,
    };
    let token: string | null = null;
    try {
      token = await getGmailAccessToken();
      await sendGmail(buildLeadTeamEmail(lead, await leadEmailTo()), token);
      team = "sent";
    } catch (err) {
      console.error("Contact API team email error:", err);
    }
    try {
      await sendGmail(buildLeadCustomerEmail(lead), token ?? (await getGmailAccessToken()));
      customer = "sent";
    } catch (err) {
      console.error("Contact API customer receipt error:", err);
    }

    if (subscribe) {
      try {
        await subscribeToMailchimp({ email, firstName, lastName, tag: "Website Contact Form" });
        mailchimp = "subscribed";
      } catch (err) {
        console.error("Mailchimp subscribe (contact form) failed:", err);
      }
    }
  }

  if (saved) {
    await ref
      .update({ emails: { team, customer, at: FieldValue.serverTimestamp() }, mailchimp })
      .catch((err) => console.error("Contact form: status update failed:", err));
  } else if (team !== "sent") {
    // Neither saved nor emailed: the message would be lost, so say so.
    return NextResponse.json({ error: "Failed to send message. Please try again later." }, { status: 500 });
  }

  // id: used as the Meta event ID for the Contact event.
  return NextResponse.json({ ok: true, id: ref.id });
}
