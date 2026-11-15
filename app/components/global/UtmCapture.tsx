"use client";

import { useEffect } from "react";
import { captureUtmFromUrl, decorateBookingLinkOnInteraction } from "@/lib/analytics/utm-client";

const LINK_EVENTS = ["click", "auxclick", "contextmenu"] as const;

/**
 * Reads the landing URL's UTM parameters once per page load, so the enquiry
 * and contact forms can send them later, and adds them to booking-form links
 * as they are followed. Renders nothing. See utm-client.ts.
 */
export default function UtmCapture() {
  useEffect(() => {
    captureUtmFromUrl();
    for (const type of LINK_EVENTS) {
      document.addEventListener(type, decorateBookingLinkOnInteraction, true);
    }
    return () => {
      for (const type of LINK_EVENTS) {
        document.removeEventListener(type, decorateBookingLinkOnInteraction, true);
      }
    };
  }, []);
  return null;
}
