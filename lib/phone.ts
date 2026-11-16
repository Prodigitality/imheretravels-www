import {
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js";

/**
 * Phone numbers on the enquiry and contact forms. The team follows up on
 * WhatsApp, so a number is only accepted with its country: the form sends it in
 * international (E.164) form, e.g. +447700900123, and the API routes check it
 * again with `normalizePhone`.
 *
 * Most ad traffic comes from the UK and Ireland, so those two head the country
 * list; the default country is the visitor's (from their IP), else the UK.
 */

export const DEFAULT_PHONE_COUNTRY: CountryCode = "GB";
const PRIORITY: CountryCode[] = ["GB", "IE"];

export type PhoneCountryOption = { code: CountryCode; name: string; callingCode: string };

let cached: { priority: PhoneCountryOption[]; rest: PhoneCountryOption[] } | null = null;

/** UK and Ireland first, then every other country by name. */
export function phoneCountryOptions() {
  if (cached) return cached;
  let names: Intl.DisplayNames | null = null;
  try {
    names = new Intl.DisplayNames(["en"], { type: "region" });
  } catch {
    names = null;
  }
  const toOption = (code: CountryCode): PhoneCountryOption => ({
    code,
    name: names?.of(code) ?? code,
    callingCode: getCountryCallingCode(code),
  });
  const priority = PRIORITY.map(toOption);
  const rest = getCountries()
    .filter((code) => !PRIORITY.includes(code))
    .map(toOption)
    .sort((a, b) => a.name.localeCompare(b.name, "en"));
  cached = { priority, rest };
  return cached;
}

export function isPhoneCountry(code: unknown): code is CountryCode {
  return typeof code === "string" && (getCountries() as string[]).includes(code);
}

/**
 * The number typed into the field (local format like "07700 900123" is fine)
 * as E.164 for `country`, or null when it isn't a valid number there.
 */
export function phoneToE164(national: string, country: CountryCode): string | null {
  const parsed = parsePhoneNumberFromString(national, country);
  return parsed?.isValid() ? parsed.number : null;
}

/**
 * Server check: a full international number (leading +). Returns the E.164
 * form to store and a readable one for emails, or null.
 */
export function normalizePhone(input: unknown): { e164: string; display: string } | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!trimmed.startsWith("+") || trimmed.length > 40) return null;
  const parsed = parsePhoneNumberFromString(trimmed);
  if (!parsed?.isValid()) return null;
  return { e164: parsed.number, display: parsed.formatInternational() };
}
