/**
 * Emails for Work With Us submissions:
 *  - team notification → bella@ (subject says Host Application / Affiliate
 *    Application / Supplier Enquiry; Reply-To is the applicant; the supplier's
 *    document is attached so it can be opened straight from Gmail)
 *  - applicant confirmation (received + will be reviewed; never implies
 *    acceptance; commission/eligibility subject to programme terms)
 */

import {
  CALENDLY_URL,
  TEAM_NOTIFY_EMAIL,
  forms,
  otherFieldName,
  type FormField,
  type PartnerType,
} from "@/data/workWithUs";
import { escapeHtml, formatAddress, type MailMessage, type MailAttachment } from "@/lib/gmail";
import { rowsHtml, rowsText, shell } from "@/lib/email-layout";
import type { ApplicationAnswers } from "./schema";

const ADMIN_BASE_URL = process.env.ADMIN_BASE_URL || "https://admin.imheretravels.com";

const PROGRAMME_NAME: Record<PartnerType, string> = {
  host: "IHT Host Programme",
  affiliate: "IHT Affiliate Creator Programme",
  supplier: "IHT Travel Supplier network",
};

export interface SubmissionSummary {
  id: string;
  type: PartnerType;
  name: string;
  email: string;
  country: string;
  org?: string;
  answers: ApplicationAnswers;
  attachment?: MailAttachment & { size: number };
}

/**
 * Display text for one answer. A chosen "Other" / "Somewhere else" option is
 * shown with what the applicant typed, e.g. "Travel, Other: Food & drink".
 */
function displayValue(f: FormField, answers: ApplicationAnswers): string {
  const v = answers[f.name];
  const other = f.otherOption ? String(answers[otherFieldName(f.name)] ?? "").trim() : "";
  const show = (opt: string) => (other && opt === f.otherOption ? `${opt}: ${other}` : opt);
  if (Array.isArray(v)) return v.map(show).join(", ");
  return v ? show(v) : "";
}

/** Ordered [label, value] rows using the form's own labels. */
export function answerRows(type: PartnerType, answers: ApplicationAnswers): [string, string][] {
  return forms[type].fields
    .map((f) => [f.label.replace(/[?.:]$/, ""), displayValue(f, answers)] as [string, string])
    .filter(([, v]) => v.trim() !== "");
}


export function buildTeamEmail(s: SubmissionSummary): MailMessage {
  const cfg = forms[s.type];
  const rows = answerRows(s.type, s.answers);
  const who = s.org ? `${s.org} (${s.name})` : s.name;
  const subject = `[${cfg.kindLabel}] ${who}${s.country ? ` · ${s.country}` : ""}`;
  const adminUrl = `${ADMIN_BASE_URL}/partnerships?id=${encodeURIComponent(s.id)}`;
  const attachmentNote = s.attachment
    ? `<p style="margin:16px 0 0 0;">📎 Attached: <strong>${escapeHtml(s.attachment.filename)}</strong> (${(s.attachment.size / 1024 / 1024).toFixed(2)} MB)</p>`
    : "";

  const html = shell(`
<p style="margin:0 0 4px 0;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#EF3340;font-weight:bold;">New ${escapeHtml(cfg.kindLabel)}</p>
<h1 style="margin:0 0 16px 0;font-size:22px;">${escapeHtml(who)}</h1>
<p style="margin:0 0 16px 0;">Submitted through <a href="https://www.imheretravels.com/work-with-us" style="color:#EF3340;">imheretravels.com/work-with-us</a>. Reply to this email to answer the applicant directly.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border-top:1px solid #F2F0EE;">
${rowsHtml(rows)}
</table>
${attachmentNote}
<p style="margin:24px 0 0 0;"><a href="${escapeHtml(adminUrl)}" style="display:inline-block;background:#1C1F2A;color:#ffffff;text-decoration:none;padding:10px 20px;border-radius:999px;font-weight:bold;">Open in admin</a></p>
<p style="margin:12px 0 0 0;font-size:12px;color:#959595;">Reference: ${escapeHtml(s.id)}</p>`);

  const text = [
    `New ${cfg.kindLabel}: ${who}`,
    "",
    rowsText(rows),
    s.attachment ? `Attached: ${s.attachment.filename}` : "",
    `Open in admin: ${adminUrl}`,
    `Reference: ${s.id}`,
  ].join("\n");

  return {
    to: TEAM_NOTIFY_EMAIL,
    from: formatAddress("IHT Website", TEAM_NOTIFY_EMAIL),
    replyTo: formatAddress(s.name, s.email),
    subject,
    html,
    text,
    attachments: s.attachment ? [s.attachment] : undefined,
  };
}

export function buildApplicantEmail(s: SubmissionSummary): MailMessage {
  const cfg = forms[s.type];
  const firstName = s.name.split(/\s+/)[0] || "there";
  const programme = PROGRAMME_NAME[s.type];
  const rows = answerRows(s.type, s.answers);
  const isSupplier = s.type === "supplier";
  const received = isSupplier ? "enquiry" : "application";

  const terms = isSupplier
    ? "Our team will review your details and get in touch if there's an opportunity to collaborate."
    : "Our team reviews every application personally and will be in touch if there's a good fit. Submitting an application doesn't confirm a place in the programme, and commission rates, eligibility, booking thresholds and any flight support are subject to the programme terms and individual agreements.";

  const html = shell(`
<h1 style="margin:0 0 16px 0;font-size:22px;">Thanks, ${escapeHtml(firstName)}! We've received your ${received}.</h1>
<p style="margin:0 0 12px 0;">Thank you for your interest in the ${escapeHtml(programme)}. ${escapeHtml(terms)}</p>
<p style="margin:0 0 20px 0;">Want to talk it through sooner? You're welcome to book a 20-minute call with Bella, our Partnership &amp; Communications Manager.</p>
<p style="margin:0 0 28px 0;"><a href="${CALENDLY_URL}" style="display:inline-block;background:#EF3340;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:999px;font-weight:bold;">Book a call with Bella</a></p>
<p style="margin:0 0 8px 0;font-weight:bold;">A copy of what you sent us</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border-top:1px solid #F2F0EE;">
${rowsHtml(rows)}
</table>
<p style="margin:24px 0 0 0;">Warm regards,<br/>Bella<br/><span style="color:#505050;">Partnership &amp; Communications, I'm Here Travels</span></p>
<p style="margin:16px 0 0 0;font-size:12px;color:#959595;">Reference: ${escapeHtml(s.id)}</p>`);

  const text = [
    `Thanks, ${firstName}! We've received your ${received}.`,
    "",
    `Thank you for your interest in the ${programme}. ${terms}`,
    "",
    `Want to talk it through sooner? Book a 20-minute call with Bella: ${CALENDLY_URL}`,
    "",
    "A copy of what you sent us:",
    "",
    rowsText(rows),
    "Warm regards,",
    "Bella",
    "Partnership & Communications, I'm Here Travels",
    "",
    `Reference: ${s.id}`,
  ].join("\n");

  return {
    to: formatAddress(s.name, s.email),
    from: formatAddress("Bella | I'm Here Travels", TEAM_NOTIFY_EMAIL),
    replyTo: TEAM_NOTIFY_EMAIL,
    subject: `We've received your ${cfg.kindLabel.toLowerCase()} – I'm Here Travels`,
    html,
    text,
  };
}
