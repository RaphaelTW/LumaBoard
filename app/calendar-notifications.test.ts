import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const agenda = readFileSync(new URL("./agenda-module.tsx", import.meta.url), "utf8");
const experience = readFileSync(new URL("./experience-module.tsx", import.meta.url), "utf8");
const widgets = readFileSync(new URL("./local-widgets.ts", import.meta.url), "utf8");
const storage = readFileSync(new URL("./storage.ts", import.meta.url), "utf8");

describe("Calendar & Notifications v1.7.0", () => {
  it("offers month, week, day and list calendar views", () => {
    expect(agenda).toContain('type AgendaView = "month" | "week" | "day" | "list"');
    expect(agenda).toContain('setView("day")');
    expect(agenda).toContain('setView("list")');
  });

  it("supports occurrence, future-series and whole-series actions", () => {
    expect(agenda).toContain("updateFollowingOccurrences");
    expect(agenda).toContain("skipOccurrence");
    expect(agenda).toContain("duplicateEvent");
  });

  it("includes a local inbox, snooze and quiet hours", () => {
    expect(experience).toContain("CAIXA DE ENTRADA LOCAL");
    expect(experience).toContain("quietHoursEnabled");
    expect(widgets).toContain("snoozeNotification");
    expect(widgets).toContain("isWithinQuietHours");
  });

  it("backs up the new notification keys with storage version 7", () => {
    expect(storage).toContain("export const STORAGE_VERSION = 7");
    expect(storage).toContain('"lumaboard-notification-inbox-v1"');
    expect(storage).toContain('"lumaboard-notification-settings-v1"');
  });
});
