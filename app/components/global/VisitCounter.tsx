"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { captureUtmFromUrl, getUtm } from "@/lib/analytics/utm-client";

/**
 * Cookie-free visit counter: tells /api/visit (see there for what is counted
 * and stored) about visits, sale page views, tour pages opened after the sale
 * page, and time spent on the sale page. Works whatever the cookie choice,
 * since it sets no cookies and stores nothing on the device: the state below
 * lives in memory for this page load only.
 *
 * Renders nothing. Mounted everywhere; /api/visit only writes on the live site.
 */

let countedVisit = false;
let sawSale = false;
let countedSaleThenTour = false;
let saleVisibleSince: number | null = null;
let saleTimedOnce = false;

const TOUR_PAGE = /^\/tours\/[^/]+\/?$/;

function send(e: string, extra: Record<string, unknown> = {}) {
  if (navigator.webdriver) return;
  const body = JSON.stringify({ e, utm: getUtm(), ...extra });
  try {
    if (navigator.sendBeacon?.("/api/visit", new Blob([body], { type: "application/json" }))) return;
  } catch {
    // Fall through to fetch.
  }
  fetch("/api/visit", {
    method: "POST",
    body,
    keepalive: true,
    headers: { "Content-Type": "application/json" },
  }).catch(() => {});
}

/** Report the sale page time since it was last visible, if any. */
function flushSaleTime() {
  if (saleVisibleSince === null) return;
  const seconds = Math.round((Date.now() - saleVisibleSince) / 1000);
  saleVisibleSince = null;
  if (seconds <= 0) return;
  send("sale_time", { s: seconds, first: !saleTimedOnce });
  saleTimedOnce = true;
}

export default function VisitCounter({ salePath }: { salePath: string | null }) {
  const pathname = usePathname();
  const onSale = !!salePath && pathname === salePath;

  useEffect(() => {
    // Make sure the landing URL's UTMs are read before the first count.
    captureUtmFromUrl();
    if (!countedVisit) {
      countedVisit = true;
      send("visit");
    }
    if (onSale) {
      if (!sawSale) {
        sawSale = true;
        send("sale");
      }
      if (document.visibilityState === "visible") saleVisibleSince = Date.now();
    } else if (sawSale && !countedSaleThenTour && TOUR_PAGE.test(pathname)) {
      countedSaleThenTour = true;
      send("sale_tour");
    }
    // Leaving the sale page (or this effect re-running) ends its timer.
    return () => {
      if (onSale) flushSaleTime();
    };
  }, [pathname, onSale]);

  useEffect(() => {
    if (!onSale) return;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flushSaleTime();
      else if (saleVisibleSince === null) saleVisibleSince = Date.now();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flushSaleTime);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flushSaleTime);
    };
  }, [onSale]);

  return null;
}
