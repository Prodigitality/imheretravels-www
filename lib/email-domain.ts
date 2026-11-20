/**
 * Server-only: refuses an email whose domain can't receive mail (no MX and no
 * A/AAAA record), e.g. "gmaill.com", before the enquiry or contact message is
 * saved and the customer's receipt bounces. A DNS timeout or outage never
 * blocks a lead: only a definite "this domain doesn't exist / has no mail
 * server" does.
 */

import { resolve4, resolve6, resolveMx } from "node:dns/promises";
import { suggestEmail } from "@/lib/email-typo";

const NOT_THERE = new Set(["ENOTFOUND", "ENODATA", "ENONAME", "NXDOMAIN"]);
const TIMEOUT_MS = 2500;

type Lookup = "yes" | "no" | "unknown";

async function has(fn: () => Promise<unknown[]>): Promise<Lookup> {
  try {
    const out = await Promise.race([
      fn(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), TIMEOUT_MS)),
    ]);
    if (out === null) return "unknown";
    return out.length > 0 ? "yes" : "no";
  } catch (e) {
    return NOT_THERE.has((e as { code?: string })?.code ?? "") ? "no" : "unknown";
  }
}

/** A message for the customer when the domain can't take email, else null. */
export async function emailDomainProblem(email: string): Promise<string | null> {
  const domain = email.slice(email.lastIndexOf("@") + 1).toLowerCase();
  if (!domain) return null;
  const mx = await has(() => resolveMx(domain));
  if (mx !== "no") return null;
  // No MX: mail can still go to the domain's own address (RFC 5321 §5.1).
  const [a, aaaa] = await Promise.all([has(() => resolve4(domain)), has(() => resolve6(domain))]);
  if (a !== "no" || aaaa !== "no") return null;
  const fix = suggestEmail(email);
  return fix
    ? `We couldn't find the email domain "${domain}". Did you mean ${fix}?`
    : `We couldn't find the email domain "${domain}". Please check your email address.`;
}
