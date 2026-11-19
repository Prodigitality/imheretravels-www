"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { contactForm } from "@/data/contactUs";
import { trackEvent } from "@/lib/analytics/track";
import { getUtm } from "@/lib/analytics/utm-client";
import PhoneField, { usePhoneField } from "@/app/components/global/PhoneField";

type Status = "idle" | "submitting" | "success" | "error";

export default function ContactForm() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    message: "",
    subscribe: false,
    acceptedPrivacy: false,
  });
  const phone = usePhoneField();
  const [phoneInvalid, setPhoneInvalid] = useState(false);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMessage("");

    if (!phone.e164) {
      setStatus("error");
      setPhoneInvalid(true);
      setErrorMessage(
        phone.number.trim()
          ? "Please check your phone number and its country code."
          : "Please enter your phone number.",
      );
      return;
    }
    setPhoneInvalid(false);

    if (!form.acceptedPrivacy) {
      setStatus("error");
      setErrorMessage("Please accept our privacy policy to continue.");
      return;
    }

    setStatus("submitting");

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, phone: phone.e164, utm: getUtm() }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; id?: string };
      if (!res.ok) throw new Error(data?.error || "Failed to send message");
      setStatus("success");
      // event_id = the message's id (Meta de-duplication). tour/tour_name are
      // cleared because GTM keeps keys from earlier pushes on the same page.
      trackEvent("form_submission", {
        form_name: "contact_us",
        tour: undefined,
        tour_name: undefined,
        event_id: data.id,
      });
      // Its own URL, so a sent message can be counted by page (ads, GA4).
      router.push("/message-sent");
    } catch (err) {
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  const inputClass =
    "w-full rounded-sm border-[1.5px] border-grey/60 px-4 py-3 font-body text-b2-mobile text-midnight outline-none placeholder:text-grey focus:border-midnight md:text-b2-desktop";

  return (
    <form className="flex flex-col gap-5" onSubmit={onSubmit} noValidate>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <input
          type="text"
          required
          value={form.firstName}
          onChange={(e) => update("firstName", e.target.value)}
          placeholder={contactForm.fields.firstName}
          className={inputClass}
        />
        <input
          type="text"
          required
          value={form.lastName}
          onChange={(e) => update("lastName", e.target.value)}
          placeholder={contactForm.fields.lastName}
          className={inputClass}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <input
          type="email"
          required
          value={form.email}
          onChange={(e) => update("email", e.target.value)}
          placeholder={contactForm.fields.email}
          className={inputClass}
        />
        <PhoneField phone={phone} inputClass={inputClass} placeholder={contactForm.fields.phone} invalid={phoneInvalid} />
      </div>
      <textarea
        required
        value={form.message}
        onChange={(e) => update("message", e.target.value)}
        placeholder={contactForm.fields.message}
        rows={4}
        className={`${inputClass} resize-y`}
      />
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={form.subscribe}
          onChange={(e) => update("subscribe", e.target.checked)}
          className="mt-1 size-4 shrink-0 cursor-pointer accent-crimson-red"
        />
        <span className="font-body text-b2-mobile text-midnight md:text-b2-desktop">
          {contactForm.checkboxes[0]}
        </span>
      </label>
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          required
          checked={form.acceptedPrivacy}
          onChange={(e) => update("acceptedPrivacy", e.target.checked)}
          className="mt-1 size-4 shrink-0 cursor-pointer accent-crimson-red"
        />
        <span className="font-body text-b2-mobile text-midnight md:text-b2-desktop">
          By checking this, you accept our{" "}
          <Link
            href="/privacy-policy"
            className="text-crimson-red underline transition-colors hover:text-light-red"
          >
            privacy policy
          </Link>{" "}
          *
        </span>
      </label>

      {status === "error" && errorMessage && (
        <p className="font-body text-b2-mobile text-crimson-red md:text-b2-desktop">
          {errorMessage}
        </p>
      )}

      <div>
        <button
          type="submit"
          disabled={status === "submitting" || status === "success"}
          className="inline-flex items-center justify-center rounded-full bg-crimson-red px-10 py-3 font-body font-bold text-b2-mobile text-white transition-colors hover:bg-light-red disabled:cursor-not-allowed disabled:opacity-60 md:text-b2-desktop"
        >
          {status === "submitting" || status === "success" ? "Sending..." : contactForm.submitLabel}
        </button>
      </div>
    </form>
  );
}
