"use client";

import { useEffect } from "react";

// Registers the service worker so RentLink is installable as an Android app
// (Add to home screen / Play Store TWA) and can show an offline page.
export default function PwaRegister() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const register = () => navigator.serviceWorker.register("/sw.js").catch(() => {});
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);
  return null;
}
