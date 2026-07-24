import { describe, expect, it } from "vitest";
import { exportAgendaICS, getNextOccurrence, importAgendaICS, listOccurrences, type AgendaEvent } from "./local-widgets";

function event(patch: Partial<AgendaEvent> = {}): AgendaEvent {
  return {
    id: "event-1",
    title: "Lembrete",
    date: "2026-07-26",
    time: "09:00",
    kind: "reminder",
    recurrence: "once",
    category: "personal",
    color: "moss",
    completedDates: [],
    ...patch,
  };
}

describe("agenda recurrence", () => {
  it("keeps a one-time event on its selected date", () => {
    expect(getNextOccurrence(event(), "2026-07-23")?.date).toBe("2026-07-26");
    expect(getNextOccurrence(event(), "2026-07-27")).toBeNull();
  });

  it("repeats monthly on the same day", () => {
    const monthly = event({ recurrence: "monthly" });
    expect(getNextOccurrence(monthly, "2026-08-01")?.date).toBe("2026-08-26");
    expect(getNextOccurrence(monthly, "2027-01-27")?.date).toBe("2027-02-26");
  });

  it("moves to the following occurrence after completion", () => {
    const monthly = event({ recurrence: "monthly", completedDates: ["2026-07-26"] });
    expect(getNextOccurrence(monthly, "2026-07-23")?.date).toBe("2026-08-26");
  });

  it("repeats weekly on the original weekday", () => {
    const weekly = event({ recurrence: "weekly" });
    expect(getNextOccurrence(weekly, "2026-07-27")?.date).toBe("2026-08-02");
  });

  it("keeps weekly recurrence stable across daylight-saving changes", () => {
    const weekly = event({ date: "2026-10-18", recurrence: "weekly" });
    expect(getNextOccurrence(weekly, "2026-10-25")?.date).toBe("2026-10-25");
  });

  it("skips months that do not contain the selected day", () => {
    const monthly = event({ date: "2026-01-31", recurrence: "monthly" });
    expect(getNextOccurrence(monthly, "2026-02-01")?.date).toBe("2026-03-31");
  });

  it("supports selected weekdays and a recurrence end date", () => {
    const weekdays = event({
      date: "2026-07-20",
      recurrence: "weekly",
      repeatDays: [1, 3, 5],
      endDate: "2026-08-05",
    });
    expect(getNextOccurrence(weekdays, "2026-07-21")?.date).toBe("2026-07-22");
    expect(getNextOccurrence(weekdays, "2026-08-06")).toBeNull();
  });

  it("does not force the initial date when a different weekday was selected", () => {
    const weekdays = event({ date: "2026-07-20", recurrence: "weekly", repeatDays: [3] });
    expect(getNextOccurrence(weekdays, "2026-07-19")?.date).toBe("2026-07-22");
  });

  it("lists completed and skipped occurrences correctly", () => {
    const recurring = event({
      date: "2026-07-20",
      recurrence: "daily",
      completedDates: ["2026-07-21"],
      skippedDates: ["2026-07-22"],
    });
    expect(listOccurrences([recurring], "2026-07-20", "2026-07-23", true).map((item) => item.date)).toEqual([
      "2026-07-20",
      "2026-07-21",
      "2026-07-23",
    ]);
  });

  it("exports and imports recurring agenda items as ICS", () => {
    const source = event({
      recurrence: "weekly",
      repeatDays: [1, 3],
      endDate: "2026-09-30",
      notes: "Planejamento\nEquipe",
    });
    const text = exportAgendaICS([source]);
    expect(text).toContain("RRULE:FREQ=WEEKLY;BYDAY=MO,WE;UNTIL=20260930T235959");
    expect(text).not.toContain("\r\nUNTIL:");
    const imported = importAgendaICS(text);
    expect(imported).toHaveLength(1);
    expect(imported[0].recurrence).toBe("weekly");
    expect(imported[0].repeatDays).toEqual([1, 3]);
    expect(imported[0].endDate).toBe("2026-09-30");
  });

});
