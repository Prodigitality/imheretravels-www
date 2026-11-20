"use client";

import { suggestEmail } from "@/lib/email-typo";

/**
 * "Did you mean sam@gmail.com?" under an email field when the domain looks
 * like a typo of a common provider. One tap fixes it; it never blocks the form.
 */
export default function EmailSuggestion({ email, onUse }: { email: string; onUse: (fixed: string) => void }) {
  const fix = email.includes("@") ? suggestEmail(email) : null;
  if (!fix) return null;
  return (
    <p className="mt-1.5 font-body text-sm text-dark-gray" aria-live="polite">
      Did you mean{" "}
      <button
        type="button"
        onClick={() => onUse(fix)}
        className="font-bold text-crimson-red underline underline-offset-2 hover:text-light-red"
      >
        {fix}
      </button>
      ?
    </p>
  );
}
