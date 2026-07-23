import { describe, expect, it } from "vitest";
import { migrateBackup, safeParseJSON, validateBackupPayload } from "./storage";

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
    expect(migrated?.version).toBe(4);
    expect(migrated?.data["lumaboard-studio"]).toEqual({ screenName: "Manhã" });
  });
});
