"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { exportLocalBackup, importLocalBackup, migrateBackup, readStoredValue, safeParseJSON, writeStoredValue } from "./storage";

export const APP_VERSION = "1.6.0";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type PWASettings = {
  startInDisplay: boolean;
  lastSyncAt: string | null;
  lastCacheAt: string | null;
  updateDismissedAt: string | null;
};

type PWAContextValue = {
  online: boolean;
  updateAvailable: boolean;
  installAvailable: boolean;
  installed: boolean;
  settings: PWASettings;
  statusText: string;
  hasUpdateBackup: boolean;
  install: () => Promise<boolean>;
  applyUpdate: () => void;
  checkForUpdate: () => Promise<void>;
  syncNow: () => void;
  setStartInDisplay: (value: boolean) => void;
  createSafetySnapshot: () => boolean;
  restoreUpdateBackup: () => boolean;
  clearUpdateBackup: () => void;
};

const fallbackSettings: PWASettings = { startInDisplay: false, lastSyncAt: null, lastCacheAt: null, updateDismissedAt: null };
const PWAContext = createContext<PWAContextValue | null>(null);

function isPWASettings(value: unknown): value is PWASettings {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<PWASettings>;
  return typeof candidate.startInDisplay === "boolean" && (candidate.lastSyncAt === null || typeof candidate.lastSyncAt === "string") && (candidate.lastCacheAt === null || typeof candidate.lastCacheAt === "string") && (candidate.updateDismissedAt === null || typeof candidate.updateDismissedAt === "string");
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function restoreSafetySnapshot() {
  if (typeof window === "undefined") return;
  const raw = window.sessionStorage.getItem("lumaboard-update-snapshot");
  if (!raw) return;
  try {
    const snapshot = JSON.parse(raw) as Record<string, string>;
    for (const [key, value] of Object.entries(snapshot)) {
      if (!key.startsWith("lumaboard-") || window.localStorage.getItem(key) !== null) continue;
      window.localStorage.setItem(key, value);
    }
  } catch {
    // Invalid snapshots are discarded below.
  }
  window.sessionStorage.removeItem("lumaboard-update-snapshot");
}

export function PWAProvider({ children }: { children: ReactNode }) {
  const [online, setOnline] = useState(true);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [settings, setSettings] = useState<PWASettings>(fallbackSettings);
  const [hasUpdateBackup, setHasUpdateBackup] = useState(false);
  const reloadingRef = useRef(false);

  const persistSettings = useCallback((patch: Partial<PWASettings>) => {
    setSettings((current) => {
      const next = { ...current, ...patch };
      writeStoredValue("lumaboard-pwa-v1", next);
      return next;
    });
  }, []);

  const createSafetySnapshot = useCallback(() => {
    if (typeof window === "undefined") return false;
    try {
      const snapshot: Record<string, string> = {};
      for (let index = 0; index < window.localStorage.length; index += 1) {
        const key = window.localStorage.key(index);
        if (!key?.startsWith("lumaboard-")) continue;
        const value = window.localStorage.getItem(key);
        if (value !== null) snapshot[key] = value;
      }
      window.sessionStorage.setItem("lumaboard-update-snapshot", JSON.stringify(snapshot));
      window.sessionStorage.setItem("lumaboard-update-backup", JSON.stringify(exportLocalBackup()));
      setHasUpdateBackup(true);
      return true;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    restoreSafetySnapshot();
    const initialSettings = readStoredValue<PWASettings>("lumaboard-pwa-v1", isPWASettings, fallbackSettings);
    queueMicrotask(() => {
      setSettings(initialSettings);
      setOnline(navigator.onLine);
      setInstalled(isStandalone());
      setHasUpdateBackup(Boolean(window.sessionStorage.getItem("lumaboard-update-backup")));
    });

    const beforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const appInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", beforeInstall);
    window.addEventListener("appinstalled", appInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", beforeInstall);
      window.removeEventListener("appinstalled", appInstalled);
    };
  }, []);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let active = true;
    const watch = (worker: ServiceWorker | null) => {
      if (!worker) return;
      worker.addEventListener("statechange", () => {
        if (worker.state === "installed" && navigator.serviceWorker.controller) setUpdateAvailable(true);
      });
    };
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).then((next) => {
      if (!active) return;
      setRegistration(next);
      if (next.waiting) setUpdateAvailable(true);
      next.addEventListener("updatefound", () => watch(next.installing));
      return next.update();
    }).catch(() => undefined);

    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "CACHE_READY" || event.data?.type === "API_CACHE_UPDATED") {
        persistSettings({ lastCacheAt: new Date().toISOString() });
      }
    };
    const onControllerChange = () => {
      if (reloadingRef.current) return;
      reloadingRef.current = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    return () => {
      active = false;
      navigator.serviceWorker.removeEventListener("message", onMessage);
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, [persistSettings]);

  useEffect(() => {
    const updateNetwork = () => {
      const next = navigator.onLine;
      setOnline(next);
      if (next) {
        const now = new Date().toISOString();
        persistSettings({ lastSyncAt: now });
        window.dispatchEvent(new CustomEvent("lumaboard:reconnect", { detail: { at: now } }));
      }
    };
    window.addEventListener("online", updateNetwork);
    window.addEventListener("offline", updateNetwork);
    return () => {
      window.removeEventListener("online", updateNetwork);
      window.removeEventListener("offline", updateNetwork);
    };
  }, [persistSettings]);

  useEffect(() => {
    if (!settings.startInDisplay || !installed || window.location.pathname !== "/") return;
    if (window.sessionStorage.getItem("lumaboard-display-started") === "1") return;
    window.sessionStorage.setItem("lumaboard-display-started", "1");
    window.location.replace("/display");
  }, [installed, settings.startInDisplay]);

  const install = useCallback(async () => {
    if (!installPrompt) return false;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") setInstallPrompt(null);
    return choice.outcome === "accepted";
  }, [installPrompt]);

  const restoreUpdateBackup = useCallback(() => {
    const raw = window.sessionStorage.getItem("lumaboard-update-backup");
    const backup = migrateBackup(safeParseJSON(raw));
    if (!backup) return false;
    const result = importLocalBackup(backup);
    if (result.imported === 0) return false;
    window.sessionStorage.removeItem("lumaboard-update-backup");
    setHasUpdateBackup(false);
    return true;
  }, []);

  const clearUpdateBackup = useCallback(() => {
    window.sessionStorage.removeItem("lumaboard-update-backup");
    window.sessionStorage.removeItem("lumaboard-update-snapshot");
    setHasUpdateBackup(false);
  }, []);

  const applyUpdate = useCallback(() => {
    const worker = registration?.waiting;
    if (!worker) return;
    createSafetySnapshot();
    worker.postMessage({ type: "SKIP_WAITING" });
  }, [createSafetySnapshot, registration]);

  const checkForUpdate = useCallback(async () => {
    await registration?.update();
    if (registration?.waiting) setUpdateAvailable(true);
  }, [registration]);

  const syncNow = useCallback(() => {
    const now = new Date().toISOString();
    persistSettings({ lastSyncAt: now });
    window.dispatchEvent(new CustomEvent("lumaboard:reconnect", { detail: { at: now, manual: true } }));
  }, [persistSettings]);

  const value = useMemo<PWAContextValue>(() => ({
    online,
    updateAvailable,
    installAvailable: Boolean(installPrompt),
    installed,
    settings,
    statusText: online ? (settings.lastSyncAt ? "dados atuais" : "online") : "dados em cache",
    hasUpdateBackup,
    install,
    applyUpdate,
    checkForUpdate,
    syncNow,
    setStartInDisplay: (value) => persistSettings({ startInDisplay: value }),
    createSafetySnapshot,
    restoreUpdateBackup,
    clearUpdateBackup,
  }), [online, updateAvailable, installPrompt, installed, settings, hasUpdateBackup, install, applyUpdate, checkForUpdate, syncNow, persistSettings, createSafetySnapshot, restoreUpdateBackup, clearUpdateBackup]);

  return <PWAContext.Provider value={value}>{children}</PWAContext.Provider>;
}

export function usePWA() {
  const value = useContext(PWAContext);
  if (!value) throw new Error("usePWA must be used inside PWAProvider");
  return value;
}
