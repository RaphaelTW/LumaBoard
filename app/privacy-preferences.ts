"use client";

import { useEffect, useState } from "react";

export const CONSENT_KEY = "lumaboard-consent-v1";
export const LEGAL_ACCEPTANCE_KEY = "lumaboard-legal-acceptance-v1";
export const PRIVACY_VERSION = "1.0";

export type ConsentPreferences = {
  version: string;
  necessary: true;
  preferences: boolean;
  externalContent: boolean;
  analytics: boolean;
  advertising: boolean;
  updatedAt: string;
};

export const defaultConsentPreferences: ConsentPreferences = {
  version: PRIVACY_VERSION,
  necessary: true,
  preferences: true,
  externalContent: true,
  analytics: false,
  advertising: false,
  updatedAt: "",
};

export function readConsentPreferences(): ConsentPreferences | null {
  if (typeof window === "undefined") return null;
  try {
    const value = JSON.parse(window.localStorage.getItem(CONSENT_KEY) ?? "null") as Partial<ConsentPreferences> | null;
    if (!value || value.version !== PRIVACY_VERSION) return null;
    return { ...defaultConsentPreferences, ...value, necessary: true };
  } catch {
    return null;
  }
}

export function hasExternalContentConsent(): boolean {
  return readConsentPreferences()?.externalContent === true;
}

export function openPrivacyPreferences() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("lumaboard:open-privacy"));
}

export function useExternalContentConsent() {
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const sync = (event?: Event) => {
      if (event instanceof CustomEvent && event.detail && typeof event.detail === "object") {
        const detail = event.detail as Partial<ConsentPreferences>;
        setAllowed(detail.externalContent === true);
        return;
      }
      setAllowed(hasExternalContentConsent());
    };
    queueMicrotask(sync);
    window.addEventListener("lumaboard:consent", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("lumaboard:consent", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return allowed;
}
