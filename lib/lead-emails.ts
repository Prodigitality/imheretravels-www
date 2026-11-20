/**
 * Emails for a tour enquiry ("Inquire now") or a /contact-us message:
 *  - team notification → the recipients set in admin Settings (lib/lead-recipients.ts; bella@ follows up, jay@ at
 *    WaveX follows the ad campaigns). Reply-To is the customer. Subjects stay
 *    "Tour Enquiry: <tour>" / "New Website Enquiry" so inbox filters keep working.
 *  - customer receipt: we've got it, a copy of what they sent, how we'll reply.
 * Both carry "Reference: <enquiry id>": admin's "View in Gmail" searches for it,
 * so staff can reply inside the customer's receipt thread.
 * Same branded layout as the Work With Us emails (lib/email-layout.ts).
 */

import { escapeHtml, formatAddress, type MailMessage } from "@/lib/gmail";
import { button, eyebrow, rowsTable, rowsText, shell } from "@/lib/email-layout";
import { utmRows, type Utm } from "@/lib/analytics/utm";

/** The Gmail account the emails go out from (and where customer replies land). */
export const LEAD_SENDER = "bella@imheretravels.com";

const ADMIN_BASE_URL = process.env.ADMIN_BASE_URL || "https://admin.imheretravels.com";
const SITE_URL = "https://www.imheretravels.com";

export interface LeadSummary {
  /** The `enquiries` doc id (empty if the save failed). */
  id: string;
  form: "tour_enquiry" | "contact_us";
  firstName: string;
  fullName: string;
  email: string;
  /** Phone as shown to people, e.g. "+44 7911 123456". */
  phoneDisplay: string;
  /** E.164, e.g. "+447911123456" (for the WhatsApp link). */
  phoneE164: string;
  message: string;
  subscribe: boolean;
  tourName?: string;
  tourSlug?: string;
  utm: Utm | null;
}

const tourUrlOf = (s: LeadSummary) => (s.tourSlug ? `${SITE_URL}/tours/${s.tourSlug}` : "");

/** What the customer sent, as shown in both emails. */
function sentRows(s: LeadSummary): [string, string][] {
  return [
    ...(s.form === "tour_enquiry" ? ([["Tour", s.tourName || "Not specified"]] as [string, string][]) : []),
    ["Name", s.fullName],
    ["Email", s.email],
    ["Phone", s.phoneDisplay],
    ["Message", s.message || "(none)"],
  ];
}

/** `to`: the team recipients, from leadEmailTo() (lib/lead-recipients.ts). */
export function buildLeadTeamEmail(s: LeadSummary, to: string): MailMessage {
  const isEnquiry = s.form === "tour_enquiry";
  const subject = isEnquiry ? (s.tourName ? `Tour Enquiry: ${s.tourName}` : "New Tour Enquiry") : "New Website Enquiry";
  const tourUrl = tourUrlOf(s);
  const adminUrl = s.id ? `${ADMIN_BASE_URL}/enquiries?id=${encodeURIComponent(s.id)}` : "";
  const whatsApp = `https://wa.me/${s.phoneE164.replace(/[^0-9]/g, "")}`;
  const rows: [string, string][] = [...sentRows(s), ["Subscribed to updates", s.subscribe ? "Yes" : "No"]];
  const utm = utmRows(s.utm);
  const source = isEnquiry
    ? tourUrl
      ? `the <a href="${escapeHtml(tourUrl)}" style="color:#EF3340;">${escapeHtml(s.tourName || s.tourSlug || "tour")}</a> page`
      : "the website"
    : `the <a href="${SITE_URL}/contact-us" style="color:#EF3340;">contact page</a>`;

  const campaign = utm.length
    ? `<p style="margin:24px 0 8px 0;font-weight:bold;">Campaign (UTM)</p>${rowsTable(utm)}`
    : `<p style="margin:24px 0 0 0;font-size:13px;color:#505050;">Campaign (UTM): none (not from a tagged ad or link).</p>`;

  const html = shell(`
${eyebrow(isEnquiry ? "New tour enquiry" : "New contact message")}
<h1 style="margin:0 0 16px 0;font-size:22px;">${escapeHtml(s.fullName)}${isEnquiry && s.tourName ? ` · ${escapeHtml(s.tourName)}` : ""}</h1>
<p style="margin:0 0 16px 0;">Sent from ${source}. Reply to this email to answer ${escapeHtml(s.firstName)} directly, or <a href="${escapeHtml(whatsApp)}" style="color:#EF3340;">message them on WhatsApp</a>.</p>
${rowsTable(rows)}
${campaign}
${adminUrl ? `<p style="margin:24px 0 0 0;">${button(adminUrl, "Open in admin", "dark")}</p>` : ""}
${s.id ? `<p style="margin:12px 0 0 0;font-size:12px;color:#959595;">Reference: ${escapeHtml(s.id)}</p>` : ""}`);

  const text = [
    isEnquiry ? `New tour enquiry: ${s.fullName}${s.tourName ? ` · ${s.tourName}` : ""}` : `New contact message: ${s.fullName}`,
    "",
    rowsText(rows),
    utm.length ? `Campaign (UTM):\n${utm.map(([k, v]) => `${k}: ${v}`).join("\n")}` : "Campaign (UTM): none",
    "",
    `WhatsApp: ${whatsApp}`,
    tourUrl,
    adminUrl ? `Open in admin: ${adminUrl}` : "",
    s.id ? `Reference: ${s.id}` : "",
  ].join("\n");

  return {
    to,
    from: formatAddress("IHT Website", LEAD_SENDER),
    replyTo: formatAddress(s.fullName, s.email),
    subject,
    html,
    text,
  };
}

export function buildLeadCustomerEmail(s: LeadSummary): MailMessage {
  const isEnquiry = s.form === "tour_enquiry";
  const tourUrl = tourUrlOf(s);
  const what = isEnquiry ? "enquiry" : "message";
  const intro = isEnquiry
    ? `We're glad you're interested in ${s.tourName || "travelling with us"}. Our team will get back to you by email or WhatsApp soon.`
    : "Our team will get back to you by email or WhatsApp soon.";

  const html = shell(`
<h1 style="margin:0 0 16px 0;font-size:22px;">Thanks, ${escapeHtml(s.firstName)}! We've received your ${what}.</h1>
<p style="margin:0 0 12px 0;">${escapeHtml(intro)}</p>
<p style="margin:0 0 20px 0;">Anything to add? Just reply to this email.</p>
${isEnquiry && tourUrl ? `<p style="margin:0 0 28px 0;">${button(tourUrl, `View ${s.tourName || "the tour"}`)}</p>` : ""}
<p style="margin:0 0 8px 0;font-weight:bold;">A copy of what you sent us</p>
${rowsTable(sentRows(s))}
<p style="margin:24px 0 0 0;">Warm regards,<br/>Bella and the I'm Here Travels team</p>
<p style="margin:16px 0 0 0;font-size:12px;color:#959595;">You're getting this because you sent us ${isEnquiry ? "an" : "a"} ${what} at <a href="${SITE_URL}" style="color:#959595;">imheretravels.com</a>.${s.id ? ` Reference: ${escapeHtml(s.id)}` : ""}</p>`);

  const text = [
    `Thanks, ${s.firstName}! We've received your ${what}.`,
    "",
    intro,
    "Anything to add? Just reply to this email.",
    isEnquiry && tourUrl ? `\n${s.tourName || "The tour"}: ${tourUrl}` : "",
    "",
    "A copy of what you sent us:",
    "",
    rowsText(sentRows(s)),
    "Warm regards,",
    "Bella and the I'm Here Travels team",
    s.id ? `\nReference: ${s.id}` : "",
  ].join("\n");

  return {
    to: formatAddress(s.fullName, s.email),
    from: formatAddress("Bella | I'm Here Travels", LEAD_SENDER),
    replyTo: LEAD_SENDER,
    subject: isEnquiry
      ? `We've received your enquiry${s.tourName ? ` about ${s.tourName}` : ""} – I'm Here Travels`
      : "We've received your message – I'm Here Travels",
    html,
    text,
  };
}
