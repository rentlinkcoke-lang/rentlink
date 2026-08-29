"use client";

import { useEffect, useState } from "react";

// After the Play Store hand-off, set this to the listing URL and the section
// automatically swaps the PWA "Install" button for a Google Play badge.
const PLAY_STORE_URL: string | null = null;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function InstallApp() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) setInstalled(true);

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === "dismissed") setDismissed(true);
    setDeferred(null);
  }

  // ---- Play Store badge (once we have a listing) ----
  if (PLAY_STORE_URL) {
    return (
      <a href={PLAY_STORE_URL} target="_blank" rel="noreferrer" style={playBtn}>
        <PlayGlyph />
        <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
          <span style={{ fontSize: 11, opacity: 0.85 }}>GET IT ON</span>
          <span style={{ fontSize: 18, fontWeight: 700 }}>Google Play</span>
        </span>
      </a>
    );
  }

  // ---- already installed ----
  if (installed) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#6fe08f", fontWeight: 600, fontSize: 15 }}>
        <span>✓</span> Installed — open RentLink from your home screen.
      </div>
    );
  }

  // ---- PWA install ----
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {deferred ? (
        <button onClick={install} style={installBtn}>
          <DownloadGlyph /> Install the app
        </button>
      ) : (
        <div style={{ ...installBtn, cursor: "default", background: "rgba(255,255,255,0.08)", color: "#fff", border: "1px solid rgba(255,255,255,0.16)" }}>
          <DownloadGlyph /> Add to Home screen
        </div>
      )}
      <div style={{ color: "#9fb7a8", fontSize: 13, lineHeight: 1.5, maxWidth: 340 }}>
        {dismissed
          ? "No problem — you can install any time from the browser menu."
          : deferred
            ? "Installs in seconds. Works like a normal app, no Play Store needed."
            : "On Android Chrome: ⋮ menu → “Install app”. On iPhone: Share → “Add to Home Screen”."}
      </div>
    </div>
  );
}

const installBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 9,
  background: "#fff",
  color: "#0f3d24",
  fontWeight: 700,
  fontSize: 15,
  padding: "13px 22px",
  borderRadius: 12,
  border: "none",
  cursor: "pointer",
  width: "fit-content",
};

const playBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 12,
  background: "#000",
  color: "#fff",
  padding: "11px 20px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.25)",
  width: "fit-content",
};

function DownloadGlyph() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v12" /><path d="M7 11l5 5 5-5" /><path d="M5 21h14" />
    </svg>
  );
}

function PlayGlyph() {
  return (
    <svg width="22" height="24" viewBox="0 0 24 26" aria-hidden>
      <path d="M2 2 L2 24 L20 13 Z" fill="#00e0ff" />
      <path d="M2 2 L14 13 L2 24 Z" fill="#00f076" opacity="0.9" />
      <path d="M2 24 L14 13 L20 13 Z" fill="#ffce00" opacity="0.9" />
      <path d="M2 2 L14 13 L20 13 Z" fill="#ff3a44" opacity="0.9" />
    </svg>
  );
}
