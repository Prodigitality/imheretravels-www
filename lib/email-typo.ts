/**
 * "Did you mean …@gmail.com?" for a mistyped email domain. Browser-safe (no
 * Node imports): the forms show it as a hint under the email field, and the
 * API routes add it to the "domain doesn't exist" error (lib/email-domain.ts).
 * A suggestion never blocks a submit on its own: some near-misses are real
 * providers (mail.com, gmx.com), which is why they're listed as KNOWN.
 */

/** The providers customers mistype most, and look-alikes that are real. */
const COMMON = [
  "gmail.com", "googlemail.com", "yahoo.com", "yahoo.co.uk", "hotmail.com", "hotmail.co.uk",
  "outlook.com", "live.com", "live.co.uk", "icloud.com", "me.com", "aol.com", "msn.com",
  "btinternet.com", "sky.com", "proton.me", "protonmail.com", "ymail.com",
];
const KNOWN = new Set([...COMMON, "mail.com", "gmx.com", "gmx.net", "mac.com", "comcast.net", "web.de", "yandex.com"]);

function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length];
}

/** The corrected address, e.g. "sam@gmaill.com" → "sam@gmail.com", or null. */
export function suggestEmail(email: string): string | null {
  const at = email.trim().lastIndexOf("@");
  if (at < 1) return null;
  const local = email.trim().slice(0, at);
  const domain = email.trim().slice(at + 1).toLowerCase();
  if (!domain.includes(".") || KNOWN.has(domain)) return null;
  let best: string | null = null;
  let bestD = 3;
  for (const c of COMMON) {
    const d = distance(domain, c);
    if (d < bestD) {
      best = c;
      bestD = d;
    }
  }
  return best && bestD <= 2 ? `${local}@${best}` : null;
}
