"use client";

export const STORAGE_VERSION = 3;

export type JsonObject = Record<string, unknown>;

export type StorageKey =
  | "lumaboard-theme"
  | "lumaboard-location-v1"
  | "lumaboard-weather-v1"
  | "lumaboard-studio"
  | "lumaboard-playlist"
  | "lumaboard-devices"
  | "lumaboard-plugins"
  | "lumaboard-agenda"
  | "lumaboard-focus"
  | "lumaboard-public-data-v1"
  | "lumaboard-refresh-minutes"
  | "lumaboard-rules"
  | "lumaboard-backup-meta";

export type BackupPayload = {
  version: number;
  exportedAt: string;
  data: Partial<Record<StorageKey, unknown>>;
};

const managedKeys: StorageKey[] = [
  "lumaboard-theme",
  "lumaboard-location-v1",
  "lumaboard-weather-v1",
  "lumaboard-studio",
  "lumaboard-playlist",
  "lumaboard-devices",
  "lumaboard-plugins",
  "lumaboard-agenda",
  "lumaboard-focus",
  "lumaboard-public-data-v1",
  "lumaboard-refresh-minutes",
  "lumaboard-rules",
  "lumaboard-backup-meta",
];

export function safeParseJSON(value: string | null): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value) as unknown;
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
  const parsed = safeParseJSON(window.localStorage.getItem(key));
  return validate(parsed) ? parsed : fallback;
}

export function writeStoredValue<T>(key: StorageKey, value: T) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function removeStoredValue(key: StorageKey) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(key);
}

export function validateBackupPayload(value: unknown): value is BackupPayload {
  if (!isRecord(value)) return false;
  if (typeof value.version !== "number") return false;
  if (typeof value.exportedAt !== "string") return false;
  if (!isRecord(value.data)) return false;
  return Object.keys(value.data).every((key) =>
    managedKeys.includes(key as StorageKey),
  );
}

export function migrateBackup(value: unknown): BackupPayload | null {
  if (validateBackupPayload(value)) return value;
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
    if (typeof item === "string") legacyData[storageKey] = safeParseJSON(item);
    else if (item !== undefined) legacyData[storageKey] = item;
  }

  if (Object.keys(legacyData).length === 0) return null;
  return {
    version: STORAGE_VERSION,
    exportedAt:
      typeof value.exportedAt === "string"
        ? value.exportedAt
        : new Date().toISOString(),
    data: legacyData,
  };
}

export function exportLocalBackup(): BackupPayload {
  const data: Partial<Record<StorageKey, unknown>> = {};
  if (typeof window !== "undefined") {
    for (const key of managedKeys) {
      const parsed = safeParseJSON(window.localStorage.getItem(key));
      if (parsed !== null) data[key] = parsed;
    }
  }
  return { version: STORAGE_VERSION, exportedAt: new Date().toISOString(), data };
}

export function importLocalBackup(payload: BackupPayload) {
  for (const [key, value] of Object.entries(payload.data)) {
    if (!managedKeys.includes(key as StorageKey)) continue;
    writeStoredValue(key as StorageKey, value);
  }
  writeStoredValue("lumaboard-backup-meta", {
    version: payload.version,
    importedAt: new Date().toISOString(),
  });
}
