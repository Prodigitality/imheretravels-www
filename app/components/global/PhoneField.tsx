"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, Search } from "lucide-react";
import ReactCountryFlag from "react-country-flag";
import { getCountryCallingCode, parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";
import {
  DEFAULT_PHONE_COUNTRY,
  isPhoneCountry,
  phoneCountryOptions,
  phoneToE164,
  type PhoneCountryOption,
} from "@/lib/phone";
import useListboxNav from "@/app/components/global/useListboxNav";

/** Main country for calling codes shared by several countries. */
const MAIN_COUNTRY: Record<string, CountryCode> = {
  "1": "US",
  "7": "RU",
  "39": "IT",
  "44": "GB",
  "47": "NO",
  "61": "AU",
  "212": "MA",
  "262": "RE",
  "290": "SH",
  "358": "FI",
  "590": "GP",
  "599": "CW",
};

let visitorCountry: Promise<string | null> | null = null;

/** The visitor's country from /api/geo, fetched once per page load. */
function getVisitorCountry(): Promise<string | null> {
  visitorCountry ??= fetch("/api/geo")
    .then((res) => (res.ok ? res.json() : null))
    .then((data: { country?: string | null } | null) => data?.country ?? null)
    .catch(() => null);
  return visitorCountry;
}

/**
 * State for a `PhoneField`. The country starts as the UK and switches to the
 * visitor's own once /api/geo answers, unless they already picked one.
 * `e164` is the full number to send, or null while it isn't valid.
 */
export function usePhoneField() {
  const [country, setCountryState] = useState<CountryCode>(DEFAULT_PHONE_COUNTRY);
  const [number, setNumberState] = useState("");
  const chosen = useRef(false);

  useEffect(() => {
    let live = true;
    getVisitorCountry().then((code) => {
      if (live && !chosen.current && isPhoneCountry(code)) setCountryState(code);
    });
    return () => {
      live = false;
    };
  }, []);

  const setCountry = useCallback((code: CountryCode) => {
    chosen.current = true;
    setCountryState(code);
  }, []);

  // Digits only: letters, spaces and symbols never reach the box (a "+" is
  // kept at the very start, for a full international number).
  // A pasted full number ("+353 87…" or "00353 87…") moves the picker to its
  // country. Codes shared by several countries (+44 also covers Guernsey,
  // Jersey…) keep the current pick when it matches, else the main country.
  // A typed country code without "+" ("44 7911…") is dropped once valid.
  const setNumber = useCallback(
    (raw: string) => {
      const cleaned = raw.replace(/[^0-9+]/g, "").replace(/(?!^)\+/g, "").slice(0, 16);
      const international = cleaned.startsWith("00") ? `+${cleaned.slice(2)}` : cleaned;
      if (international.startsWith("+")) {
        const parsed = parsePhoneNumberFromString(international);
        if (parsed?.isValid() && parsed.country) {
          const code = parsed.countryCallingCode;
          const next =
            getCountryCallingCode(country) === code ? country : (MAIN_COUNTRY[code] ?? parsed.country);
          chosen.current = true;
          setCountryState(next);
          setNumberState(parsed.nationalNumber);
          return;
        }
      } else if (cleaned.startsWith(getCountryCallingCode(country))) {
        const parsed = phoneToE164(cleaned, country)
          ? parsePhoneNumberFromString(cleaned, country)
          : parsePhoneNumberFromString(`+${cleaned}`);
        if (parsed?.isValid() && parsed.countryCallingCode === getCountryCallingCode(country)) {
          setNumberState(parsed.nationalNumber);
          return;
        }
      }
      setNumberState(cleaned);
    },
    [country],
  );

  const e164 = number.trim() ? phoneToE164(number, country) : null;
  return { country, setCountry, number, setNumber, e164 };
}

export type PhoneFieldState = ReturnType<typeof usePhoneField>;

const flagStyle = {
  width: "1.25rem",
  height: "0.9rem",
  borderRadius: "2px",
  objectFit: "cover" as const,
  flexShrink: 0,
};

/**
 * Country code dropdown (flags; UK and Ireland on top) in front of the number.
 * Same look and keyboard handling as `NationalitySelect`.
 *
 * The number is checked when the visitor leaves the field (and on submit, via
 * `invalid`); the message clears as soon as the number is valid.
 */
export default function PhoneField({
  phone,
  inputClass,
  placeholder,
  invalid = false,
}: {
  phone: PhoneFieldState;
  /** The form's own text-input classes, used for the number box. */
  inputClass: string;
  placeholder: string;
  invalid?: boolean;
}) {
  const { priority, rest } = useMemo(() => phoneCountryOptions(), []);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  const errorId = useId();
  const [left, setLeft] = useState(false);

  const close = useCallback(() => setOpen(false), []);
  useListboxNav({ open, listRef, triggerRef, onClose: close, autoFocus: false });

  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    function onOutside(e: MouseEvent) {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [open]);

  // Esc closes only the menu, not the sheet or dialog the form sits in.
  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (open && e.key === "Escape") {
      e.stopPropagation();
      setOpen(false);
      triggerRef.current?.focus();
    }
  }

  const q = query.trim().toLowerCase().replace(/^\+/, "");
  const matches = (o: PhoneCountryOption) =>
    !q || o.name.toLowerCase().includes(q) || o.code.toLowerCase() === q || o.callingCode.startsWith(q);
  const top = priority.filter(matches);
  const others = rest.filter(matches);
  const selected = [...priority, ...rest].find((o) => o.code === phone.country);

  const hasNumber = phone.number.trim() !== "";
  const showError = !phone.e164 && (invalid || (left && hasNumber));
  const borderClass = showError ? "border-crimson-red" : open ? "border-midnight" : "border-grey/60";

  function renderOption(option: PhoneCountryOption) {
    const isSelected = option.code === phone.country;
    return (
      <li key={option.code}>
        <button
          type="button"
          role="option"
          aria-selected={isSelected}
          onClick={() => {
            phone.setCountry(option.code);
            setOpen(false);
            triggerRef.current?.focus();
          }}
          className={`flex w-full items-center justify-between gap-2 rounded-sm px-2.5 py-2 text-left font-body text-b2-mobile outline-none transition-colors hover:bg-light-grey focus-visible:bg-light-grey md:text-b4-desktop ${
            isSelected ? "bg-light-grey/70 font-medium text-midnight" : "text-dark-gray"
          }`}
        >
          <span className="inline-flex min-w-0 items-center gap-2.5">
            <ReactCountryFlag countryCode={option.code} svg aria-hidden style={flagStyle} />
            <span className="truncate">{option.name}</span>
            <span className="shrink-0 text-grey">+{option.callingCode}</span>
          </span>
          {isSelected && <Check className="size-4 shrink-0 text-crimson-red" />}
        </button>
      </li>
    );
  }

  return (
    <div className="relative" ref={wrapperRef} onKeyDown={onKeyDown}>
      <div className="flex gap-2">
        <button
          ref={triggerRef}
          type="button"
          onClick={() => {
            setQuery("");
            setOpen((o) => !o);
          }}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={selected ? `Country code: ${selected.name} +${selected.callingCode}` : "Country code"}
          className={`flex min-h-12 shrink-0 items-center gap-1.5 rounded-sm border-[1.5px] bg-white px-3 font-body text-base text-midnight outline-none focus:border-midnight ${borderClass}`}
        >
          {selected && <ReactCountryFlag countryCode={selected.code} svg aria-hidden style={flagStyle} />}
          <span>+{selected?.callingCode}</span>
          <ChevronDown className={`size-4 shrink-0 text-grey transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        <input
          type="tel"
          aria-label="Phone number"
          aria-invalid={showError || undefined}
          aria-describedby={showError && hasNumber ? errorId : undefined}
          autoComplete="tel-national"
          inputMode="tel"
          required
          value={phone.number}
          onChange={(e) => phone.setNumber(e.target.value)}
          onBlur={() => setLeft(true)}
          placeholder={placeholder}
          className={`${inputClass} min-w-0 flex-1 ${showError ? "!border-crimson-red" : ""}`}
        />
      </div>

      {showError && hasNumber && (
        <p id={errorId} className="mt-1.5 font-body text-b4-mobile text-crimson-red md:text-b4-desktop">
          That doesn&apos;t look like a valid {selected?.name ?? ""} number. Check the digits or the country code.
        </p>
      )}

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 top-full z-30 mt-1.5 w-full overflow-hidden rounded-md border border-light-grey bg-white shadow-medium"
          >
            <div className="flex items-center gap-2 border-b border-light-grey px-3 py-2">
              <Search className="size-4 shrink-0 text-grey" />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search country or code…"
                aria-label="Search country or code"
                className="w-full bg-transparent font-body text-base text-midnight outline-none placeholder:text-grey md:text-b4-desktop"
              />
            </div>
            <ul ref={listRef} role="listbox" aria-label="Country code" className="no-scrollbar max-h-60 overflow-y-auto p-1.5">
              {top.length + others.length === 0 && (
                <li className="px-2.5 py-2 font-body text-b2-mobile text-grey md:text-b4-desktop">No matches.</li>
              )}
              {top.map(renderOption)}
              {top.length > 0 && others.length > 0 && (
                <li role="separator" aria-hidden className="mx-2.5 my-1 border-t border-light-grey" />
              )}
              {others.map(renderOption)}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
