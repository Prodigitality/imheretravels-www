"use client";

import { useEffect } from "react";
import { captureUtmFromUrl } from "@/lib/analytics/utm-client";

/**
 * Reads the landing URL's UTM parameters once per page load, so the enquiry
 * and contact forms can send them later. Renders nothing. See utm-client.ts.
 */
export default function UtmCapture() {
  useEffect(() => {
    captureUtmFromUrl();
  }, []);
  return null;
}
