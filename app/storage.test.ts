import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { migrateBackup, readStoredValue, safeParseJSON, validateBackupPayload, writeStoredValue } from "./storage";

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
    expect(migrated?.version).toBe(6);
    expect(migrated?.data["lumaboard-studio"]).toEqual({ screenName: "Manhã" });
  });

  it("writes and reads validated local values", () => {
    expect(writeStoredValue("lumaboard-focus", { task: "Teste" })).toBe(true);
    expect(readStoredValue("lumaboard-focus", (value): value is { task: string } => Boolean(value && typeof value === "object" && "task" in value), { task: "Fallback" })).toEqual({ task: "Teste" });
  });

  it("quarantines corrupted values instead of crashing", () => {
    memory.set("lumaboard-focus", "{not-json");
    const value = readStoredValue("lumaboard-focus", (candidate): candidate is { task: string } => Boolean(candidate && typeof candidate === "object" && "task" in candidate), { task: "Seguro" });
    expect(value).toEqual({ task: "Seguro" });
    expect(memory.has("lumaboard-focus")).toBe(false);
    expect(Array.from(session.keys()).some((key) => key.startsWith("lumaboard-corrupt-lumaboard-focus"))).toBe(true);
  });
});
