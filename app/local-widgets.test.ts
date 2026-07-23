import { describe, expect, it } from "vitest";
import { getNextOccurrence, type AgendaEvent } from "./local-widgets";

function event(patch: Partial<AgendaEvent> = {}): AgendaEvent {
  return {
    id: "event-1",
    title: "Lembrete",
    date: "2026-07-26",
    time: "09:00",
    kind: "reminder",
    recurrence: "once",
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
});
