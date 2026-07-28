"use client";

import { useEffect, useState } from "react";
import { safeParseJSON } from "./storage";

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

export type LegalAcceptance = {
  termsVersion: string;
  privacyVersion: string;
  acknowledgedAt: string;
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
    const value = safeParseJSON(window.localStorage.getItem(CONSENT_KEY)) as Partial<ConsentPreferences> | null;
    if (!value || value.version !== PRIVACY_VERSION) return null;
    const updatedAt = typeof value.updatedAt === "string" && value.updatedAt.length <= 64 && !Number.isNaN(Date.parse(value.updatedAt))
      ? new Date(value.updatedAt).toISOString()
      : "";
    return {
      version: PRIVACY_VERSION,
      necessary: true,
      preferences: value.preferences === true,
      externalContent: value.externalContent === true,
      analytics: false,
      advertising: false,
      updatedAt,
    };
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
