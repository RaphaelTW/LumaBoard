"use client";

import { hasSafeJsonStructure } from "./import-security";

export const STORAGE_VERSION = 7;
export const MAX_STORAGE_ITEM_BYTES = 1_500_000;
export const MAX_BACKUP_BYTES = 4_500_000;

export type JsonObject = Record<string, unknown>;

export type StorageKey =
  | "lumaboard-theme"
  | "lumaboard-theme-v2"
  | "lumaboard-location-v1"
  | "lumaboard-weather-v1"
  | "lumaboard-studio"
  | "lumaboard-playlist"
  | "lumaboard-devices"
  | "lumaboard-plugins"
  | "lumaboard-agenda"
  | "lumaboard-agenda-notifications"
  | "lumaboard-notification-inbox-v1"
  | "lumaboard-notification-settings-v1"
  | "lumaboard-focus"
  | "lumaboard-public-data-v1"
  | "lumaboard-public-data-v2"
  | "lumaboard-public-explorer-v1"
  | "lumaboard-refresh-minutes"
  | "lumaboard-rules"
  | "lumaboard-backup-meta"
  | "lumaboard-dashboard-v2"
  | "lumaboard-music-v1"
  | "lumaboard-news-preferences-v1"
  | "lumaboard-news-state-v1"
  | "lumaboard-pwa-v1"
  | "lumaboard-notification-center-v1"
  | "lumaboard-last-view-v1"
  | "lumaboard-changelog-v1"
  | "lumaboard-performance-v1"
  | "lumaboard-storage-issues-v1"
  | "lumaboard-client-errors-v1"
  | "lumaboard-consent-v1"
  | "lumaboard-legal-acceptance-v1"
  | "lumaboard-user-profile-v1"
  | "lumaboard-template-favorites-v1";

export type BackupPayload = {
  version: number;
  exportedAt: string;
  data: Partial<Record<StorageKey, unknown>>;
};

export type StorageIssue = {
  key: string;
  reason: "corrupt" | "quota" | "too-large" | "serialization";
  occurredAt: string;
};

export const managedKeys: StorageKey[] = [
  "lumaboard-theme",
  "lumaboard-theme-v2",
  "lumaboard-location-v1",
  "lumaboard-weather-v1",
  "lumaboard-studio",
  "lumaboard-playlist",
  "lumaboard-devices",
  "lumaboard-plugins",
  "lumaboard-agenda",
  "lumaboard-agenda-notifications",
  "lumaboard-notification-inbox-v1",
  "lumaboard-notification-settings-v1",
  "lumaboard-focus",
  "lumaboard-public-data-v1",
  "lumaboard-public-data-v2",
  "lumaboard-public-explorer-v1",
  "lumaboard-refresh-minutes",
  "lumaboard-rules",
  "lumaboard-backup-meta",
  "lumaboard-dashboard-v2",
  "lumaboard-music-v1",
  "lumaboard-news-preferences-v1",
  "lumaboard-news-state-v1",
  "lumaboard-pwa-v1",
  "lumaboard-notification-center-v1",
  "lumaboard-last-view-v1",
  "lumaboard-changelog-v1",
  "lumaboard-performance-v1",
  "lumaboard-storage-issues-v1",
  "lumaboard-client-errors-v1",
  "lumaboard-consent-v1",
  "lumaboard-legal-acceptance-v1",
  "lumaboard-user-profile-v1",
  "lumaboard-template-favorites-v1",
];

const protectedBackupKeys = new Set<StorageKey>([
  "lumaboard-consent-v1",
  "lumaboard-legal-acceptance-v1",
  "lumaboard-storage-issues-v1",
  "lumaboard-client-errors-v1",
  "lumaboard-performance-v1",
  "lumaboard-backup-meta",
]);

function byteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function recordIssue(issue: StorageIssue) {
  if (typeof window === "undefined") return;
  try {
    const previous = safeParseJSON(window.localStorage.getItem("lumaboard-storage-issues-v1"));
    const issues = Array.isArray(previous) ? previous.filter((item) => isRecord(item)).slice(-19) : [];
    window.localStorage.setItem("lumaboard-storage-issues-v1", JSON.stringify([...issues, issue]));
  } catch {
    // Avoid cascading failures when the browser quota is exhausted.
  }
}

export function safeParseJSON(value: string | null): unknown {
  if (!value || byteLength(value) > MAX_STORAGE_ITEM_BYTES) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    return hasSafeJsonStructure(parsed, { maxBytes: MAX_STORAGE_ITEM_BYTES }) ? parsed : null;
  } catch {
    return null;
  }
}

export function isRecord(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function readStoredValue<T>(
  key: StorageKey,
  validate: (value: unknown) => value is T,
  fallback: T,
): T {
  if (typeof window === "undefined") return fallback;
  const raw = window.localStorage.getItem(key);
  if (!raw) return fallback;
  if (byteLength(raw) > MAX_STORAGE_ITEM_BYTES) {
    window.localStorage.removeItem(key);
    recordIssue({ key, reason: "too-large", occurredAt: new Date().toISOString() });
    return fallback;
  }
  const parsed = safeParseJSON(raw);
  if (validate(parsed)) return parsed;
  const quarantineKey = `lumaboard-corrupt-${key}-${Date.now()}`;
  try {
    if (raw.length < 250_000) window.sessionStorage.setItem(quarantineKey, raw);
    window.localStorage.removeItem(key);
  } catch {
    // Session storage can be disabled; recovery still falls back safely.
  }
  recordIssue({ key, reason: "corrupt", occurredAt: new Date().toISOString() });
  return fallback;
}

export function writeStoredValue<T>(key: StorageKey, value: T): boolean {
  if (typeof window === "undefined") return false;
  let serialized: string;
  try {
    serialized = JSON.stringify(value);
  } catch {
    recordIssue({ key, reason: "serialization", occurredAt: new Date().toISOString() });
    return false;
  }
  if (byteLength(serialized) > MAX_STORAGE_ITEM_BYTES) {
    recordIssue({ key, reason: "too-large", occurredAt: new Date().toISOString() });
    window.dispatchEvent(new CustomEvent("lumaboard:storage-error", { detail: { key, reason: "too-large" } }));
    return false;
  }
  try {
    window.localStorage.setItem(key, serialized);
    window.dispatchEvent(new CustomEvent("lumaboard:saved", { detail: { key } }));
    return true;
  } catch {
    recordIssue({ key, reason: "quota", occurredAt: new Date().toISOString() });
    window.dispatchEvent(new CustomEvent("lumaboard:storage-error", { detail: { key, reason: "quota" } }));
    return false;
  }
}

export function removeStoredValue(key: StorageKey) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(key);
}

export function validateBackupPayload(value: unknown): value is BackupPayload {
  if (!isRecord(value)) return false;
  if (typeof value.version !== "number" || value.version < 1 || value.version > STORAGE_VERSION) return false;
  if (typeof value.exportedAt !== "string" || Number.isNaN(Date.parse(value.exportedAt))) return false;
  if (!isRecord(value.data) || !hasSafeJsonStructure(value, { maxBytes: MAX_BACKUP_BYTES })) return false;
  if (!Object.keys(value.data).every((key) => managedKeys.includes(key as StorageKey))) return false;
  try {
    if (byteLength(JSON.stringify(value)) > MAX_BACKUP_BYTES) return false;
    return Object.values(value.data).every((item) => byteLength(JSON.stringify(item)) <= MAX_STORAGE_ITEM_BYTES);
  } catch {
    return false;
  }
}

export function migrateBackup(value: unknown): BackupPayload | null {
  if (validateBackupPayload(value)) return { ...value, version: STORAGE_VERSION };
  if (!isRecord(value)) return null;

  const legacyData: Partial<Record<StorageKey, unknown>> = {};
  const legacyMap: Array<[string, StorageKey]> = [
    ["studio", "lumaboard-studio"],
    ["playlist", "lumaboard-playlist"],
    ["plugins", "lumaboard-plugins"],
    ["rules", "lumaboard-rules"],
  ];

  for (const [legacyKey, storageKey] of legacyMap) {
    const item = value[legacyKey];
    const parsed = typeof item === "string" ? safeParseJSON(item) : item;
    if (parsed !== undefined && parsed !== null) legacyData[storageKey] = parsed;
  }

  if (Object.keys(legacyData).length === 0) return null;
  const exportedAt = typeof value.exportedAt === "string" && !Number.isNaN(Date.parse(value.exportedAt))
    ? new Date(value.exportedAt).toISOString()
    : new Date().toISOString();
  const candidate: BackupPayload = { version: STORAGE_VERSION, exportedAt, data: legacyData };
  return validateBackupPayload(candidate) ? candidate : null;
}

export function exportLocalBackup(): BackupPayload {
  const data: Partial<Record<StorageKey, unknown>> = {};
  if (typeof window !== "undefined") {
    for (const key of managedKeys) {
      if (protectedBackupKeys.has(key)) continue;
      const parsed = safeParseJSON(window.localStorage.getItem(key));
      if (parsed !== null) data[key] = parsed;
    }
  }
  return { version: STORAGE_VERSION, exportedAt: new Date().toISOString(), data };
}

export function importLocalBackup(payload: unknown): { imported: number; skipped: number } {
  if (!validateBackupPayload(payload)) return { imported: 0, skipped: 0 };
  let imported = 0;
  let skipped = 0;
  for (const [key, value] of Object.entries(payload.data)) {
    if (!managedKeys.includes(key as StorageKey) || protectedBackupKeys.has(key as StorageKey)) {
      skipped += 1;
      continue;
    }
    if (writeStoredValue(key as StorageKey, value)) imported += 1;
    else skipped += 1;
  }
  writeStoredValue("lumaboard-backup-meta", {
    version: STORAGE_VERSION,
    sourceVersion: payload.version,
    importedAt: new Date().toISOString(),
  });
  return { imported, skipped };
}

export function resetSettingsPreservingPersonalData() {
  const preserve = new Set<StorageKey>([
    "lumaboard-agenda",
    "lumaboard-agenda-notifications",
    "lumaboard-notification-inbox-v1",
    "lumaboard-notification-settings-v1",
    "lumaboard-focus",
    "lumaboard-news-state-v1",
    "lumaboard-music-v1",
  ]);
  for (const key of managedKeys) {
    if (!preserve.has(key)) removeStoredValue(key);
  }
}

export function storageUsage(): { bytes: number; items: number } {
  if (typeof window === "undefined") return { bytes: 0, items: 0 };
  let bytes = 0;
  let items = 0;
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key?.startsWith("lumaboard-")) continue;
    const value = window.localStorage.getItem(key) ?? "";
    bytes += byteLength(key) + byteLength(value);
    items += 1;
  }
  return { bytes, items };
}
