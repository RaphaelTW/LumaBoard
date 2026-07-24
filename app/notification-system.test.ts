import { describe, expect, it } from "vitest";
import {
  createAgendaNotificationRecord,
  defaultNotificationSettings,
  isWithinQuietHours,
  normalizeNotificationInbox,
  normalizeNotificationSettings,
  notificationIsVisible,
  unreadNotificationCount,
} from "./notification-system";

describe("local notification system", () => {
  it("supports quiet hours that cross midnight", () => {
    const settings = { ...defaultNotificationSettings, quietHoursEnabled: true, quietStart: "22:00", quietEnd: "07:00" };
    expect(isWithinQuietHours(new Date("2026-07-24T23:00:00"), settings)).toBe(true);
    expect(isWithinQuietHours(new Date("2026-07-24T06:30:00"), settings)).toBe(true);
    expect(isWithinQuietHours(new Date("2026-07-24T12:00:00"), settings)).toBe(false);
  });

  it("normalizes unsafe settings", () => {
    expect(normalizeNotificationSettings({ quietStart: "99:00", defaultSnoozeMinutes: 99999 })).toEqual({
      ...defaultNotificationSettings,
      defaultSnoozeMinutes: 1440,
    });
  });

  it("creates an unread agenda notification with a stable source key", () => {
    const item = createAgendaNotificationRecord({
      eventId: "abc",
      occurrenceDate: "2026-07-26",
      title: "Pagar internet",
      time: "09:00",
      reminderMinutes: 30,
      kind: "task",
      createdAt: "2026-07-26T08:30:00.000Z",
    });
    expect(item.sourceKey).toBe("abc:2026-07-26:09:00:30");
    expect(item.readAt).toBeNull();
    expect(unreadNotificationCount([item])).toBe(1);
  });

  it("hides snoozed and dismissed items from the active inbox", () => {
    const item = createAgendaNotificationRecord({
      eventId: "abc",
      occurrenceDate: "2026-07-26",
      title: "Pagar internet",
      time: "09:00",
      reminderMinutes: 10,
      kind: "reminder",
      createdAt: new Date().toISOString(),
    });
    expect(notificationIsVisible({ ...item, snoozedUntil: new Date(Date.now() + 60_000).toISOString() })).toBe(false);
    expect(notificationIsVisible({ ...item, dismissedAt: new Date().toISOString() })).toBe(false);
  });

  it("removes history older than the configured retention", () => {
    const recent = createAgendaNotificationRecord({ eventId: "a", occurrenceDate: "2026-07-26", title: "Recent", time: "09:00", reminderMinutes: 0, kind: "reminder" });
    const old = { ...recent, id: "old", sourceKey: "old", createdAt: "2020-01-01T00:00:00.000Z" };
    expect(normalizeNotificationInbox([recent, old], { ...defaultNotificationSettings, keepHistoryDays: 30 }).map((item) => item.id)).toEqual([recent.id]);
  });
});
