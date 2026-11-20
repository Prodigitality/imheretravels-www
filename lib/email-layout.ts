/**
 * The branded email layout shared by every email the website sends: logo on
 * a white card over the brand's light grey, Arial (safe in every client), and
 * label/value tables for form answers. Used by the Work With Us emails
 * (lib/work-with-us/emails.ts) and the enquiry/contact emails
 * (lib/lead-emails.ts).
 */

import { escapeHtml } from "@/lib/gmail";

export const LOGO_URL =
  "https://firebasestorage.googleapis.com/v0/b/imheretravels-a3f81.firebasestorage.app/o/website-assets%2Fbd35684dc8836c690d9d6b4bc9e112b3eb54301a4109bc36e7eb06571c66a0c1.png?alt=media&token=2ec27c63-b0cc-444e-b8d9-579b615855c6";

/** [label, value] rows as a two-column table body. http(s) values become links. */
export function rowsHtml(rows: [string, string][]): string {
  return rows
    .map(([label, value]) => {
      const isLink = /^https?:\/\//.test(value) && !value.includes(" ");
      const isEmail = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(value);
      const safe = escapeHtml(value).replace(/\n/g, "<br/>");
      const cell = isLink
        ? `<a href="${escapeHtml(value)}" style="color:#EF3340;">${safe}</a>`
        : isEmail
          ? `<a href="mailto:${escapeHtml(value)}" style="color:#EF3340;">${safe}</a>`
          : safe;
      return `<tr>
  <td style="padding:8px 12px;border-bottom:1px solid #F2F0EE;vertical-align:top;width:38%;color:#505050;font-size:13px;">${escapeHtml(label)}</td>
  <td style="padding:8px 12px;border-bottom:1px solid #F2F0EE;vertical-align:top;color:#1C1F2A;font-size:14px;">${cell}</td>
</tr>`;
    })
    .join("\n");
}

/** The same rows as a table, ready to drop into a shell(). */
export function rowsTable(rows: [string, string][]): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border-top:1px solid #F2F0EE;">
${rowsHtml(rows)}
</table>`;
}

export function rowsText(rows: [string, string][]): string {
  return rows.map(([l, v]) => `${l}:\n${v}\n`).join("\n");
}

/** A pill button. `dark` for staff actions (Open in admin), red for customer calls to action. */
export function button(href: string, label: string, tone: "dark" | "red" = "red"): string {
  const bg = tone === "dark" ? "#1C1F2A" : "#EF3340";
  return `<a href="${escapeHtml(href)}" style="display:inline-block;background:${bg};color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:999px;font-weight:bold;">${escapeHtml(label)}</a>`;
}

/** Small red uppercase label above a heading, e.g. "NEW TOUR ENQUIRY". */
export function eyebrow(text: string): string {
  return `<p style="margin:0 0 4px 0;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#EF3340;font-weight:bold;">${escapeHtml(text)}</p>`;
}

export function shell(inner: string): string {
  return `<!doctype html><html><body style="margin:0;padding:0;background:#F2F0EE;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F2F0EE;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px;font-family:Arial,Helvetica,sans-serif;color:#1C1F2A;">
<tr><td style="padding:28px 32px 8px 32px;"><img src="${LOGO_URL}" alt="I'm Here Travels" width="160" style="display:block;border:0;height:auto;"/></td></tr>
<tr><td style="padding:8px 32px 32px 32px;font-size:15px;line-height:1.6;">${inner}</td></tr>
</table>
</td></tr></table></body></html>`;
}
