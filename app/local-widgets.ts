"use client";

import { useEffect, useMemo, useState } from "react";
import { isRecord, readStoredValue, writeStoredValue } from "./storage";

const AGENDA_KEY = "lumaboard-agenda";
const AGENDA_NOTIFICATIONS_KEY = "lumaboard-agenda-notifications";
const FOCUS_KEY = "lumaboard-focus";

export type AgendaKind = "reminder" | "task";
export type AgendaRecurrence = "once" | "daily" | "weekly" | "monthly" | "yearly";
export type AgendaCategory = "personal" | "work" | "health" | "finance" | "study" | "other";
export type AgendaColor = "moss" | "amber" | "cyan" | "rose" | "slate";
export type AgendaPriority = "low" | "normal" | "high";

export type AgendaSubtask = {
  id: string;
  title: string;
  completed: boolean;
};

export type AgendaEvent = {
  id: string;
  title: string;
  date: string;
  time: string;
  kind: AgendaKind;
  recurrence: AgendaRecurrence;
  category: AgendaCategory;
  color: AgendaColor;
  completedDates: string[];
  endDate?: string | null;
  repeatDays?: number[];
  reminderMinutes?: number;
  subtasks?: AgendaSubtask[];
  priority?: AgendaPriority;
  notes?: string;
  skippedDates?: string[];
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

function createLocalId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeSubtasks(value: unknown): AgendaSubtask[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item) || typeof item.title !== "string" || !item.title.trim()) return [];
    return [{
      id: typeof item.id === "string" && item.id ? item.id : createLocalId(),
      title: item.title.trim().slice(0, 160),
      completed: item.completed === true,
    }];
  }).slice(0, 50);
}

function normalizeAgendaEvent(value: unknown): AgendaEvent | null {
  if (!isRecord(value)) return null;
  const id = typeof value.id === "string" && value.id ? value.id : createLocalId();
  const title = typeof value.title === "string" ? value.title.trim().slice(0, 240) : "";
  if (!title || !isDateKey(value.date) || !isTimeKey(value.time)) return null;
  const kind: AgendaKind = value.kind === "task" ? "task" : "reminder";
  const recurrence: AgendaRecurrence = value.recurrence === "daily" || value.recurrence === "weekly" || value.recurrence === "monthly" || value.recurrence === "yearly" ? value.recurrence : "once";
  const category: AgendaCategory = value.category === "work" || value.category === "health" || value.category === "finance" || value.category === "study" || value.category === "other" ? value.category : "personal";
  const color: AgendaColor = value.color === "amber" || value.color === "cyan" || value.color === "rose" || value.color === "slate" ? value.color : "moss";
  const priority: AgendaPriority = value.priority === "low" || value.priority === "high" ? value.priority : "normal";
  const completedDates = Array.isArray(value.completedDates) ? Array.from(new Set(value.completedDates.filter(isDateKey))).slice(-800) : [];
  const skippedDates = Array.isArray(value.skippedDates) ? Array.from(new Set(value.skippedDates.filter(isDateKey))).slice(-800) : [];
  const repeatDays = Array.isArray(value.repeatDays)
    ? Array.from(new Set(value.repeatDays.map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))).sort()
    : [];
  const endDate = isDateKey(value.endDate) && value.endDate >= value.date ? value.endDate : null;
  const reminderMinutes = Number.isFinite(Number(value.reminderMinutes)) ? Math.min(10080, Math.max(0, Math.round(Number(value.reminderMinutes)))) : 0;
  const notes = typeof value.notes === "string" ? value.notes.trim().slice(0, 4000) : "";
  return {
    id,
    title,
    date: value.date,
    time: value.time,
    kind,
    recurrence,
    category,
    color,
    completedDates,
    endDate,
    repeatDays,
    reminderMinutes,
    subtasks: normalizeSubtasks(value.subtasks),
    priority,
    notes,
    skippedDates,
  };
}

function normalizeAgenda(value: unknown): AgendaEvent[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const event = normalizeAgendaEvent(item);
    return event ? [event] : [];
  }).slice(0, 1000);
}

function isFocus(value: unknown): value is FocusSession {
  return isRecord(value) && typeof value.project === "string" && typeof value.task === "string" && typeof value.durationMinutes === "number" && Number.isFinite(value.durationMinutes) && typeof value.remainingSeconds === "number" && Number.isFinite(value.remainingSeconds) && typeof value.running === "boolean" && (value.endsAt === null || (typeof value.endsAt === "number" && Number.isFinite(value.endsAt)));
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

function validDateKey(year: number, monthIndex: number, day: number): string | null {
  const date = new Date(year, monthIndex, day, 12, 0, 0, 0);
  if (date.getFullYear() !== year || date.getMonth() !== monthIndex || date.getDate() !== day) return null;
  return localDateKey(date);
}

export function addDays(dateKey: string, amount: number): string {
  const date = parseDateKey(dateKey);
  date.setDate(date.getDate() + amount);
  return localDateKey(date);
}

export function agendaCategoryLabel(value: AgendaCategory): string {
  return { personal: "Pessoal", work: "Trabalho", health: "Saúde", finance: "Finanças", study: "Estudos", other: "Outro" }[value];
}

export function recurrenceLabel(value: AgendaRecurrence): string {
  return { once: "Uma vez", daily: "Todos os dias", weekly: "Toda semana", monthly: "Todo mês", yearly: "Todo ano" }[value];
}

export function priorityLabel(value: AgendaPriority = "normal"): string {
  return { low: "Baixa", normal: "Normal", high: "Alta" }[value];
}

function withinEndDate(event: AgendaEvent, candidate: string): boolean {
  return !event.endDate || candidate <= event.endDate;
}

function isSkipped(event: AgendaEvent, candidate: string): boolean {
  return event.skippedDates?.includes(candidate) === true;
}

function occurrenceOnOrAfter(event: AgendaEvent, fromDate: string): string | null {
  const base = parseDateKey(event.date);
  const from = parseDateKey(fromDate);
  if (event.endDate && fromDate > event.endDate) return null;
  if (event.recurrence === "once") return event.date >= fromDate && withinEndDate(event, event.date) ? event.date : null;
  if (event.recurrence === "daily") {
    const candidate = fromDate < event.date ? event.date : fromDate;
    return withinEndDate(event, candidate) ? candidate : null;
  }

  if (event.recurrence === "weekly") {
    const days = event.repeatDays?.length ? event.repeatDays : [base.getDay()];
    const searchStart = fromDate < event.date ? event.date : fromDate;
    for (let offset = 0; offset < 14; offset += 1) {
      const candidate = addDays(searchStart, offset);
      if (candidate < event.date || !withinEndDate(event, candidate)) continue;
      if (days.includes(parseDateKey(candidate).getDay())) return candidate;
    }
    return null;
  }

  if (event.recurrence === "monthly") {
    const day = base.getDate();
    for (let offset = 0; offset < 120; offset += 1) {
      const monthIndex = from.getMonth() + offset;
      const year = from.getFullYear() + Math.floor(monthIndex / 12);
      const normalizedMonth = ((monthIndex % 12) + 12) % 12;
      const candidate = validDateKey(year, normalizedMonth, day);
      if (candidate && candidate >= fromDate && candidate >= event.date && withinEndDate(event, candidate)) return candidate;
    }
    return null;
  }

  const month = base.getMonth();
  const day = base.getDate();
  for (let year = Math.max(base.getFullYear(), from.getFullYear()); year <= from.getFullYear() + 25; year += 1) {
    const candidate = validDateKey(year, month, day);
    if (candidate && candidate >= fromDate && candidate >= event.date && withinEndDate(event, candidate)) return candidate;
  }
  return null;
}

export function getNextOccurrence(event: AgendaEvent, fromDate = localDateKey(), includeCompleted = false): AgendaOccurrence | null {
  let candidate = occurrenceOnOrAfter(event, fromDate);
  for (let attempts = 0; candidate && attempts < 1200; attempts += 1) {
    if (!isSkipped(event, candidate) && (includeCompleted || !event.completedDates.includes(candidate))) {
      return { ...event, date: candidate, occurrenceDate: candidate, completed: event.completedDates.includes(candidate) };
    }
    candidate = occurrenceOnOrAfter(event, addDays(candidate, 1));
  }
  return null;
}

export function listOccurrences(events: AgendaEvent[], startDate: string, endDate: string, includeCompleted = true): AgendaOccurrence[] {
  const result: AgendaOccurrence[] = [];
  for (const event of events) {
    let cursor = startDate;
    for (let attempts = 0; attempts < 800; attempts += 1) {
      const occurrence = getNextOccurrence(event, cursor, includeCompleted);
      if (!occurrence || occurrence.occurrenceDate > endDate) break;
      result.push(occurrence);
      cursor = addDays(occurrence.occurrenceDate, 1);
    }
  }
  return result.sort((a, b) => `${a.occurrenceDate}T${a.time}`.localeCompare(`${b.occurrenceDate}T${b.time}`));
}

export function getPreviousOccurrence(event: AgendaEvent, onOrBefore = localDateKey()): AgendaOccurrence | null {
  const start = event.date;
  if (onOrBefore < start) return null;
  const windowStart = addDays(onOrBefore, -400);
  const occurrences = listOccurrences([event], windowStart < start ? start : windowStart, onOrBefore, false);
  return occurrences.at(-1) ?? null;
}

function normalizeFocus(value: FocusSession): FocusSession {
  const durationMinutes = Math.min(120, Math.max(1, Math.round(value.durationMinutes)));
  const durationSeconds = durationMinutes * 60;
  if (value.running && value.endsAt) {
    const remainingSeconds = Math.max(0, Math.ceil((value.endsAt - Date.now()) / 1000));
    if (remainingSeconds === 0) return { ...value, durationMinutes, remainingSeconds: 0, running: false, endsAt: null };
    return { ...value, durationMinutes, remainingSeconds };
  }
  return { ...value, durationMinutes, remainingSeconds: Math.min(durationSeconds, Math.max(0, Math.round(value.remainingSeconds))), running: false, endsAt: null };
}

export function formatTimer(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function readNotifiedOccurrences(): string[] {
  return readStoredValue<string[]>(AGENDA_NOTIFICATIONS_KEY, (value): value is string[] => Array.isArray(value) && value.every((item) => typeof item === "string"), []);
}

function occurrenceTimestamp(occurrence: AgendaOccurrence): number {
  return new Date(`${occurrence.occurrenceDate}T${occurrence.time}:00`).getTime();
}

export function exportAgendaICS(events: AgendaEvent[]): string {
  const escape = (value: string) => value.replace(/\\/g, "\\\\").replace(/,/g, "\\,").replace(/;/g, "\\;").replace(/\n/g, "\\n");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//LumaBoard//Agenda local//PT-BR", "CALSCALE:GREGORIAN"];
  for (const event of events) {
    const stamp = event.date.replaceAll("-", "") + "T" + event.time.replace(":", "") + "00";
    lines.push("BEGIN:VEVENT", `UID:${escape(event.id)}@lumaboard.local`, `DTSTART:${stamp}`, `SUMMARY:${escape(event.title)}`);
    if (event.notes) lines.push(`DESCRIPTION:${escape(event.notes)}`);
    if (event.recurrence !== "once") {
      const freq = { daily: "DAILY", weekly: "WEEKLY", monthly: "MONTHLY", yearly: "YEARLY" }[event.recurrence];
      const parts = [`FREQ=${freq}`];
      if (event.recurrence === "weekly" && event.repeatDays?.length) {
        const labels = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
        parts.push(`BYDAY=${event.repeatDays.map((day) => labels[day]).join(",")}`);
      }
      if (event.endDate) parts.push(`UNTIL=${event.endDate.replaceAll("-", "")}T235959`);
      lines.push(`RRULE:${parts.join(";")}`);
    }
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export function importAgendaICS(text: string): AgendaEvent[] {
  const unfold = text.replace(/\r?\n[ \t]/g, "");
  const blocks = unfold.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g) ?? [];
  const dayMap: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
  return blocks.flatMap((block) => {
    const read = (name: string) => block.match(new RegExp(`^${name}(?:;[^:]*)?:(.*)$`, "m"))?.[1]?.trim() ?? "";
    const start = read("DTSTART");
    const match = start.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2}))?/);
    const title = read("SUMMARY").replace(/\\([,;n\\])/g, (_all, char: string) => char === "n" ? "\n" : char);
    if (!match || !title) return [];
    const rule = read("RRULE");
    const freq = rule.match(/FREQ=([^;]+)/)?.[1];
    const recurrence: AgendaRecurrence = freq === "DAILY" ? "daily" : freq === "WEEKLY" ? "weekly" : freq === "MONTHLY" ? "monthly" : freq === "YEARLY" ? "yearly" : "once";
    const until = rule.match(/UNTIL=(\d{4})(\d{2})(\d{2})/)?.slice(1, 4).join("-") ?? null;
    const byDay = rule.match(/BYDAY=([^;]+)/)?.[1]?.split(",").map((day) => dayMap[day]).filter((day) => day !== undefined) ?? [];
    return [{
      id: createLocalId(),
      title: title.slice(0, 240),
      date: `${match[1]}-${match[2]}-${match[3]}`,
      time: match[4] ? `${match[4]}:${match[5]}` : "09:00",
      kind: "reminder" as const,
      recurrence,
      category: "personal" as const,
      color: "moss" as const,
      completedDates: [],
      endDate: until,
      repeatDays: byDay,
      reminderMinutes: 0,
      subtasks: [],
      priority: "normal" as const,
      notes: read("DESCRIPTION").replace(/\\n/g, "\n"),
      skippedDates: [],
    }];
  }).slice(0, 1000);
}

export function useLocalWidgets() {
  const [events, setEvents] = useState<AgendaEvent[]>([]);
  const [focus, setFocus] = useState<FocusSession>(defaultFocus);
  const [tick, setTick] = useState(0);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | "unsupported">("default");
  const [dueEvents, setDueEvents] = useState<AgendaOccurrence[]>([]);

  useEffect(() => {
    const syncAgenda = (event: Event) => {
      if (event instanceof CustomEvent && Array.isArray(event.detail)) setEvents(normalizeAgenda(event.detail));
      else {
        const raw = readStoredValue<unknown>(AGENDA_KEY, (_value): _value is unknown => true, []);
        setEvents(normalizeAgenda(raw));
      }
    };
    window.addEventListener("lumaboard:agenda", syncAgenda);
    window.addEventListener("storage", syncAgenda);
    return () => {
      window.removeEventListener("lumaboard:agenda", syncAgenda);
      window.removeEventListener("storage", syncAgenda);
    };
  }, []);

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
      const candidates = listOccurrences(events, addDays(today, -1), addDays(today, 7), false);
      const due = candidates.filter((occurrence) => {
        const dueAt = occurrenceTimestamp(occurrence);
        const notifyAt = dueAt - (occurrence.reminderMinutes ?? 0) * 60_000;
        return now.getTime() >= notifyAt && now.getTime() <= dueAt + 24 * 60 * 60_000;
      });
      setDueEvents(due);
      if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
      const notified = new Set(readNotifiedOccurrences());
      let changed = false;
      for (const event of due) {
        const key = `${event.id}:${event.occurrenceDate}:${event.time}:${event.reminderMinutes ?? 0}`;
        if (notified.has(key)) continue;
        const prefix = (event.reminderMinutes ?? 0) > 0 ? `Em ${event.reminderMinutes} min` : event.time;
        const notification = new Notification(event.kind === "task" ? "Tarefa do LumaBoard" : "Lembrete do LumaBoard", {
          body: `${prefix} · ${event.title}`,
          tag: `lumaboard-${key}`,
          icon: "/icons/icon-192.png",
        });
        notification.onclick = () => window.focus();
        notified.add(key);
        changed = true;
      }
      if (changed) writeStoredValue(AGENDA_NOTIFICATIONS_KEY, Array.from(notified).slice(-800));
    };
    checkAgenda();
    const timer = window.setInterval(checkAgenda, 30_000);
    return () => window.clearInterval(timer);
  }, [events]);

  const visibleFocus = useMemo(() => normalizeFocus(focus), [focus, tick]);
  const persistEvents = (next: AgendaEvent[]) => {
    const normalized = normalizeAgenda(next).sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
    setEvents(normalized);
    writeStoredValue(AGENDA_KEY, normalized);
    window.dispatchEvent(new CustomEvent("lumaboard:agenda", { detail: normalized }));
  };

  const addEvent = (input: Omit<AgendaEvent, "id" | "completedDates">) => {
    const normalized = normalizeAgendaEvent({ ...input, id: createLocalId(), completedDates: [] });
    if (!normalized) return false;
    persistEvents([...events, normalized]);
    return true;
  };

  const updateEvent = (id: string, patch: Partial<AgendaEvent>) => {
    const current = events.find((event) => event.id === id);
    if (!current) return false;
    const normalized = normalizeAgendaEvent({ ...current, ...patch, id });
    if (!normalized) return false;
    persistEvents(events.map((event) => event.id === id ? normalized : event));
    return true;
  };

  const removeEvent = (id: string) => persistEvents(events.filter((event) => event.id !== id));

  const toggleEventCompleted = (id: string, occurrenceDate: string) => {
    persistEvents(events.map((event) => {
      if (event.id !== id) return event;
      const completedDates = event.completedDates.includes(occurrenceDate) ? event.completedDates.filter((date) => date !== occurrenceDate) : [...event.completedDates, occurrenceDate].slice(-800);
      return { ...event, completedDates };
    }));
  };

  const toggleSubtask = (id: string, subtaskId: string) => updateEvent(id, {
    subtasks: (events.find((event) => event.id === id)?.subtasks ?? []).map((subtask) => subtask.id === subtaskId ? { ...subtask, completed: !subtask.completed } : subtask),
  });

  const moveOccurrence = (id: string, occurrenceDate: string, newDate: string, patch: Partial<AgendaEvent> = {}) => {
    if (!isDateKey(newDate)) return false;
    const source = events.find((event) => event.id === id);
    if (!source) return false;
    if (source.recurrence === "once") return updateEvent(id, { ...patch, date: newDate });
    const moved = normalizeAgendaEvent({
      ...source,
      ...patch,
      id: createLocalId(),
      date: newDate,
      recurrence: "once",
      endDate: null,
      repeatDays: [],
      completedDates: [],
      skippedDates: [],
      title: patch.title ?? source.title,
    });
    if (!moved) return false;
    const updatedSource = { ...source, skippedDates: Array.from(new Set([...(source.skippedDates ?? []), occurrenceDate])) };
    persistEvents([...events.map((event) => event.id === id ? updatedSource : event), moved]);
    return true;
  };

  const importEvents = (incoming: AgendaEvent[]) => {
    const normalized = normalizeAgenda(incoming);
    persistEvents([...events, ...normalized].slice(-1000));
    return normalized.length;
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
    const next: FocusSession = { ...visibleFocus, durationMinutes: normalized, remainingSeconds: normalized * 60, running: false, endsAt: null };
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
    const next = { ...visibleFocus, remainingSeconds, running: true, endsAt: Date.now() + remainingSeconds * 1000 };
    setFocus(next);
    writeStoredValue(FOCUS_KEY, next);
  };
  const resetFocus = () => {
    const next = { ...visibleFocus, remainingSeconds: visibleFocus.durationMinutes * 60, running: false, endsAt: null };
    setFocus(next);
    writeStoredValue(FOCUS_KEY, next);
  };

  const now = new Date();
  const today = localDateKey(now);
  const currentMinute = now.toTimeString().slice(0, 5);
  const agendaSummary = useMemo(() => {
    const upcomingEvents = listOccurrences(events, today, addDays(today, 366), false)
      .filter((event) => event.occurrenceDate > today || event.time >= currentMinute)
      .slice(0, 100);
    const overdueTasks = listOccurrences(events.filter((event) => event.kind === "task"), addDays(today, -90), today, false)
      .filter((event) => event.occurrenceDate < today || event.time <= currentMinute)
      .sort((a, b) => `${a.occurrenceDate}T${a.time}`.localeCompare(`${b.occurrenceDate}T${b.time}`))
      .slice(-250);
    return { upcomingEvents, nextEvent: upcomingEvents[0] ?? null, overdueTasks };
  }, [currentMinute, events, today]);

  return {
    events,
    upcomingEvents: agendaSummary.upcomingEvents,
    overdueTasks: agendaSummary.overdueTasks,
    nextEvent: agendaSummary.nextEvent,
    dueEvents,
    notificationPermission,
    focus: visibleFocus,
    addEvent,
    updateEvent,
    removeEvent,
    toggleEventCompleted,
    toggleSubtask,
    moveOccurrence,
    importEvents,
    requestNotifications,
    updateFocus,
    setFocusDuration,
    toggleFocus,
    resetFocus,
    todayKey: today,
  };
}
