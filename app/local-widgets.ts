"use client";

import { useEffect, useMemo, useState } from "react";
import { isRecord, readStoredValue, writeStoredValue } from "./storage";

const AGENDA_KEY = "lumaboard-agenda";
const AGENDA_NOTIFICATIONS_KEY = "lumaboard-agenda-notifications";
const FOCUS_KEY = "lumaboard-focus";

export type AgendaKind = "reminder" | "task";
export type AgendaRecurrence = "once" | "daily" | "weekly" | "monthly" | "yearly";

export type AgendaEvent = {
  id: string;
  title: string;
  date: string;
  time: string;
  kind: AgendaKind;
  recurrence: AgendaRecurrence;
  completedDates: string[];
};

export type AgendaOccurrence = AgendaEvent & {
  occurrenceDate: string;
  completed: boolean;
};

export type FocusSession = {
  project: string;
  task: string;
  durationMinutes: number;
  remainingSeconds: number;
  running: boolean;
  endsAt: number | null;
};

const defaultFocus: FocusSession = {
  project: "Projeto LumaBoard",
  task: "Defina sua próxima tarefa",
  durationMinutes: 25,
  remainingSeconds: 25 * 60,
  running: false,
  endsAt: null,
};

function isDateKey(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isTimeKey(value: unknown): value is string {
  return typeof value === "string" && /^\d{2}:\d{2}$/.test(value);
}

function normalizeAgendaEvent(value: unknown): AgendaEvent | null {
  if (!isRecord(value)) return null;
  const id = typeof value.id === "string" && value.id ? value.id : createLocalId();
  const title = typeof value.title === "string" ? value.title.trim() : "";
  if (!title || !isDateKey(value.date) || !isTimeKey(value.time)) return null;
  const kind: AgendaKind = value.kind === "task" ? "task" : "reminder";
  const recurrence: AgendaRecurrence =
    value.recurrence === "daily" ||
    value.recurrence === "weekly" ||
    value.recurrence === "monthly" ||
    value.recurrence === "yearly"
      ? value.recurrence
      : "once";
  const completedDates = Array.isArray(value.completedDates)
    ? Array.from(new Set(value.completedDates.filter(isDateKey))).slice(-400)
    : [];
  return { id, title, date: value.date, time: value.time, kind, recurrence, completedDates };
}

function normalizeAgenda(value: unknown): AgendaEvent[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const event = normalizeAgendaEvent(item);
    return event ? [event] : [];
  });
}

function isFocus(value: unknown): value is FocusSession {
  return (
    isRecord(value) &&
    typeof value.project === "string" &&
    typeof value.task === "string" &&
    typeof value.durationMinutes === "number" &&
    Number.isFinite(value.durationMinutes) &&
    typeof value.remainingSeconds === "number" &&
    Number.isFinite(value.remainingSeconds) &&
    typeof value.running === "boolean" &&
    (value.endsAt === null || (typeof value.endsAt === "number" && Number.isFinite(value.endsAt)))
  );
}

export function localDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateKey(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function dateSerial(value: string): number {
  const [year, month, day] = value.split("-").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

function createLocalId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function validDateKey(year: number, monthIndex: number, day: number): string | null {
  const date = new Date(year, monthIndex, day, 12, 0, 0, 0);
  if (date.getFullYear() !== year || date.getMonth() !== monthIndex || date.getDate() !== day) {
    return null;
  }
  return localDateKey(date);
}

function addDays(dateKey: string, amount: number): string {
  const date = parseDateKey(dateKey);
  date.setDate(date.getDate() + amount);
  return localDateKey(date);
}

export function recurrenceLabel(value: AgendaRecurrence): string {
  const labels: Record<AgendaRecurrence, string> = {
    once: "Uma vez",
    daily: "Todos os dias",
    weekly: "Toda semana",
    monthly: "Todo mês",
    yearly: "Todo ano",
  };
  return labels[value];
}

function occurrenceOnOrAfter(event: AgendaEvent, fromDate: string): string | null {
  const base = parseDateKey(event.date);
  const from = parseDateKey(fromDate);
  if (event.recurrence === "once") return event.date >= fromDate ? event.date : null;
  if (from <= base) return event.date;

  if (event.recurrence === "daily") return fromDate;

  if (event.recurrence === "weekly") {
    const elapsedDays = dateSerial(fromDate) - dateSerial(event.date);
    const remainder = ((elapsedDays % 7) + 7) % 7;
    return remainder === 0 ? fromDate : addDays(fromDate, 7 - remainder);
  }

  if (event.recurrence === "monthly") {
    const day = base.getDate();
    for (let offset = 0; offset < 36; offset += 1) {
      const monthIndex = from.getMonth() + offset;
      const year = from.getFullYear() + Math.floor(monthIndex / 12);
      const normalizedMonth = ((monthIndex % 12) + 12) % 12;
      const candidate = validDateKey(year, normalizedMonth, day);
      if (candidate && candidate >= fromDate && candidate >= event.date) return candidate;
    }
    return null;
  }

  const month = base.getMonth();
  const day = base.getDate();
  for (let year = Math.max(base.getFullYear(), from.getFullYear()); year <= from.getFullYear() + 8; year += 1) {
    const candidate = validDateKey(year, month, day);
    if (candidate && candidate >= fromDate && candidate >= event.date) return candidate;
  }
  return null;
}

export function getNextOccurrence(event: AgendaEvent, fromDate = localDateKey()): AgendaOccurrence | null {
  let candidate = occurrenceOnOrAfter(event, fromDate);
  for (let attempts = 0; candidate && attempts < 420; attempts += 1) {
    if (!event.completedDates.includes(candidate)) {
      return { ...event, date: candidate, occurrenceDate: candidate, completed: false };
    }
    candidate = occurrenceOnOrAfter(event, addDays(candidate, 1));
  }
  return null;
}

function normalizeFocus(value: FocusSession): FocusSession {
  const durationMinutes = Math.min(120, Math.max(1, Math.round(value.durationMinutes)));
  const durationSeconds = durationMinutes * 60;
  if (value.running && value.endsAt) {
    const remainingSeconds = Math.max(0, Math.ceil((value.endsAt - Date.now()) / 1000));
    if (remainingSeconds === 0) {
      return { ...value, durationMinutes, remainingSeconds: 0, running: false, endsAt: null };
    }
    return { ...value, durationMinutes, remainingSeconds };
  }
  return {
    ...value,
    durationMinutes,
    remainingSeconds: Math.min(durationSeconds, Math.max(0, Math.round(value.remainingSeconds))),
    running: false,
    endsAt: null,
  };
}

export function formatTimer(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const minutesPart = Math.floor(seconds / 60);
  const secondsPart = seconds % 60;
  return `${String(minutesPart).padStart(2, "0")}:${String(secondsPart).padStart(2, "0")}`;
}

function readNotifiedOccurrences(): string[] {
  return readStoredValue<string[]>(
    AGENDA_NOTIFICATIONS_KEY,
    (value): value is string[] => Array.isArray(value) && value.every((item) => typeof item === "string"),
    [],
  );
}

export function useLocalWidgets() {
  const [events, setEvents] = useState<AgendaEvent[]>([]);
  const [focus, setFocus] = useState<FocusSession>(defaultFocus);
  const [tick, setTick] = useState(0);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | "unsupported">("default");
  const [dueEvents, setDueEvents] = useState<AgendaOccurrence[]>([]);

  useEffect(() => {
    const rawEvents = readStoredValue<unknown>(AGENDA_KEY, (_value): _value is unknown => true, []);
    const savedEvents = normalizeAgenda(rawEvents);
    const savedFocus = readStoredValue<FocusSession>(FOCUS_KEY, isFocus, defaultFocus);
    queueMicrotask(() => {
      setEvents(savedEvents);
      setFocus(normalizeFocus(savedFocus));
      setNotificationPermission(typeof Notification === "undefined" ? "unsupported" : Notification.permission);
    });
    writeStoredValue(AGENDA_KEY, savedEvents);
  }, []);

  useEffect(() => {
    if (!focus.running || !focus.endsAt) return;
    const timer = window.setInterval(() => {
      const remainingSeconds = Math.max(0, Math.ceil((focus.endsAt! - Date.now()) / 1000));
      if (remainingSeconds === 0) {
        const next = { ...focus, remainingSeconds: 0, running: false, endsAt: null };
        setFocus(next);
        writeStoredValue(FOCUS_KEY, next);
        return;
      }
      setTick((value) => value + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [focus]);

  useEffect(() => {
    const checkAgenda = () => {
      const now = new Date();
      const today = localDateKey(now);
      const currentTime = now.toTimeString().slice(0, 5);
      const due = events.flatMap((event) => {
        const occurrence = getNextOccurrence(event, today);
        if (!occurrence || occurrence.occurrenceDate !== today || occurrence.time > currentTime) return [];
        return [occurrence];
      });
      setDueEvents(due);

      if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
      const notified = new Set(readNotifiedOccurrences());
      let changed = false;
      due.forEach((event) => {
        const key = `${event.id}:${event.occurrenceDate}:${event.time}`;
        if (notified.has(key)) return;
        const notification = new Notification(event.kind === "task" ? "Tarefa do LumaBoard" : "Lembrete do LumaBoard", {
          body: `${event.time} · ${event.title}`,
          tag: `lumaboard-${key}`,
        });
        notification.onclick = () => window.focus();
        notified.add(key);
        changed = true;
      });
      if (changed) writeStoredValue(AGENDA_NOTIFICATIONS_KEY, Array.from(notified).slice(-400));
    };

    checkAgenda();
    const timer = window.setInterval(checkAgenda, 30_000);
    return () => window.clearInterval(timer);
  }, [events]);

  const visibleFocus = useMemo(() => normalizeFocus(focus), [focus, tick]);

  const persistEvents = (next: AgendaEvent[]) => {
    const sorted = [...next].sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
    setEvents(sorted);
    writeStoredValue(AGENDA_KEY, sorted);
  };

  const addEvent = (input: Omit<AgendaEvent, "id" | "completedDates">) => {
    const title = input.title.trim();
    if (!title || !isDateKey(input.date) || !isTimeKey(input.time)) return false;
    persistEvents([...events, { ...input, title, id: createLocalId(), completedDates: [] }]);
    return true;
  };

  const removeEvent = (id: string) => persistEvents(events.filter((event) => event.id !== id));

  const toggleEventCompleted = (id: string, occurrenceDate: string) => {
    persistEvents(events.map((event) => {
      if (event.id !== id) return event;
      const completedDates = event.completedDates.includes(occurrenceDate)
        ? event.completedDates.filter((date) => date !== occurrenceDate)
        : [...event.completedDates, occurrenceDate].slice(-400);
      return { ...event, completedDates };
    }));
  };

  const requestNotifications = async () => {
    if (typeof Notification === "undefined") {
      setNotificationPermission("unsupported");
      return "unsupported" as const;
    }
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
    return permission;
  };

  const updateFocus = (patch: Partial<FocusSession>) => {
    const next = normalizeFocus({ ...visibleFocus, ...patch });
    setFocus(next);
    writeStoredValue(FOCUS_KEY, next);
  };

  const setFocusDuration = (durationMinutes: number) => {
    const normalized = Math.min(120, Math.max(1, Math.round(durationMinutes)));
    const next: FocusSession = {
      ...visibleFocus,
      durationMinutes: normalized,
      remainingSeconds: normalized * 60,
      running: false,
      endsAt: null,
    };
    setFocus(next);
    writeStoredValue(FOCUS_KEY, next);
  };

  const toggleFocus = () => {
    if (visibleFocus.running) {
      const next = { ...visibleFocus, running: false, endsAt: null };
      setFocus(next);
      writeStoredValue(FOCUS_KEY, next);
      return;
    }
    const remainingSeconds = visibleFocus.remainingSeconds || visibleFocus.durationMinutes * 60;
    const next = {
      ...visibleFocus,
      remainingSeconds,
      running: true,
      endsAt: Date.now() + remainingSeconds * 1000,
    };
    setFocus(next);
    writeStoredValue(FOCUS_KEY, next);
  };

  const resetFocus = () => {
    const next = {
      ...visibleFocus,
      remainingSeconds: visibleFocus.durationMinutes * 60,
      running: false,
      endsAt: null,
    };
    setFocus(next);
    writeStoredValue(FOCUS_KEY, next);
  };

  const today = localDateKey();
  const currentTime = new Date().toTimeString().slice(0, 5);
  const upcomingEvents = events
    .flatMap((event) => {
      const occurrence = getNextOccurrence(event, today);
      if (!occurrence) return [];
      if (occurrence.date === today && occurrence.time < currentTime) {
        const next = getNextOccurrence(event, addDays(today, 1));
        return next ? [next] : [];
      }
      return [occurrence];
    })
    .sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
  const nextEvent = upcomingEvents[0] ?? null;

  return {
    events,
    upcomingEvents,
    nextEvent,
    dueEvents,
    notificationPermission,
    focus: visibleFocus,
    addEvent,
    removeEvent,
    toggleEventCompleted,
    requestNotifications,
    updateFocus,
    setFocusDuration,
    toggleFocus,
    resetFocus,
    todayKey: today,
  };
}
