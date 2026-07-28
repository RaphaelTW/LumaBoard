import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { exportLocalBackup, managedKeys, migrateBackup, readStoredValue, safeParseJSON, STORAGE_VERSION, validateBackupPayload, writeStoredValue } from "./storage";

const memory = new Map<string, string>();
const session = new Map<string, string>();

function storage(map: Map<string, string>): Storage {
  return {
    get length() { return map.size; },
    clear: () => map.clear(),
    getItem: (key) => map.get(key) ?? null,
    key: (index) => Array.from(map.keys())[index] ?? null,
    removeItem: (key) => { map.delete(key); },
    setItem: (key, value) => { map.set(key, String(value)); },
  };
}

beforeEach(() => {
  memory.clear();
  session.clear();
  vi.stubGlobal("CustomEvent", class<T> extends Event {
    detail: T;
    constructor(type: string, init?: CustomEventInit<T>) {
      super(type);
      this.detail = init?.detail as T;
    }
  });
  vi.stubGlobal("window", { localStorage: storage(memory), sessionStorage: storage(session), dispatchEvent: vi.fn() });
});

afterEach(() => vi.unstubAllGlobals());

describe("local backup storage", () => {
  it("keeps storage version 7 and news keys canonical", () => {
    expect(STORAGE_VERSION).toBe(7);
    expect(managedKeys.filter((key) => key === "lumaboard-news-preferences-v1")).toHaveLength(1);
    expect(managedKeys.filter((key) => key === "lumaboard-news-state-v1")).toHaveLength(1);
  });

  it("returns null for corrupted JSON", () => {
    expect(safeParseJSON("{bad json")).toBeNull();
  });

  it("rejects invalid backup imports", () => {
    expect(validateBackupPayload({ version: 2, exportedAt: "now", data: { unknown: true } })).toBe(false);
    expect(migrateBackup({ nope: true })).toBeNull();
  });

  it("migrates legacy backup payloads", () => {
    const migrated = migrateBackup({
      exportedAt: "2026-07-21T12:00:00Z",
      studio: JSON.stringify({ screenName: "Manhã" }),
      playlist: JSON.stringify([{ id: 1 }]),
    });
    expect(migrated?.version).toBe(7);
    expect(migrated?.data["lumaboard-studio"]).toEqual({ screenName: "Manhã" });
  });

  it("writes and reads validated local values", () => {
    expect(writeStoredValue("lumaboard-focus", { task: "Teste" })).toBe(true);
    expect(readStoredValue("lumaboard-focus", (value): value is { task: string } => Boolean(value && typeof value === "object" && "task" in value), { task: "Fallback" })).toEqual({ task: "Teste" });
  });

  it("exports news preferences and state once without losing saved news", () => {
    writeStoredValue("lumaboard-news-preferences-v1", { Tecnologia: { source: "all" } });
    writeStoredValue("lumaboard-news-state-v1", { readIds: ["hn-1"], savedIds: ["dev-2"] });
    const backup = exportLocalBackup();
    expect(Object.keys(backup.data).filter((key) => key === "lumaboard-news-preferences-v1")).toHaveLength(1);
    expect(Object.keys(backup.data).filter((key) => key === "lumaboard-news-state-v1")).toHaveLength(1);
    expect(backup.data["lumaboard-news-state-v1"]).toEqual({ readIds: ["hn-1"], savedIds: ["dev-2"] });
  });


  it("excludes consent, legal acknowledgement and diagnostics from backups", () => {
    writeStoredValue("lumaboard-consent-v1", { necessary: true, externalContent: false });
    writeStoredValue("lumaboard-legal-acceptance-v1", { acknowledgedAt: "2026-07-28T12:00:00.000Z" });
    writeStoredValue("lumaboard-client-errors-v1", [{ message: "local path" }]);
    writeStoredValue("lumaboard-performance-v1", { duration: 10 });
    writeStoredValue("lumaboard-storage-issues-v1", [{ key: "x" }]);
    const backup = exportLocalBackup();
    for (const key of ["lumaboard-consent-v1", "lumaboard-legal-acceptance-v1", "lumaboard-client-errors-v1", "lumaboard-performance-v1", "lumaboard-storage-issues-v1"]) {
      expect(backup.data[key as keyof typeof backup.data]).toBeUndefined();
    }
  });

  it("rejects legacy backups whose decoded values exceed structural limits", () => {
    expect(migrateBackup({ studio: JSON.stringify({ items: Array.from({ length: 6000 }, (_, index) => index) }) })).toBeNull();
  });

  it("quarantines corrupted values instead of crashing", () => {
    memory.set("lumaboard-focus", "{not-json");
    const value = readStoredValue("lumaboard-focus", (candidate): candidate is { task: string } => Boolean(candidate && typeof candidate === "object" && "task" in candidate), { task: "Seguro" });
    expect(value).toEqual({ task: "Seguro" });
    expect(memory.has("lumaboard-focus")).toBe(false);
    expect(Array.from(session.keys()).some((key) => key.startsWith("lumaboard-corrupt-lumaboard-focus"))).toBe(true);
  });
});
