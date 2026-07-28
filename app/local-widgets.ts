"use client";

import { useEffect, useMemo, useState } from "react";
import { isRecord, readStoredValue, writeStoredValue } from "./storage";
import {
  agendaNotificationSourceKey,
  createAgendaNotificationRecord,
  defaultNotificationSettings,
  isWithinQuietHours,
  normalizeNotificationInbox,
  normalizeNotificationSettings,
  notificationIsVisible,
  unreadNotificationCount,
  type LocalNotificationRecord,
  type NotificationSettings,
} from "./notification-system";

const AGENDA_KEY = "lumaboard-agenda";
const AGENDA_NOTIFICATIONS_KEY = "lumaboard-agenda-notifications";
const NOTIFICATION_INBOX_KEY = "lumaboard-notification-inbox-v1";
const NOTIFICATION_SETTINGS_KEY = "lumaboard-notification-settings-v1";
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
  reminderMinutesList?: number[];
  durationMinutes?: number;
  location?: string;
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
  if (typeof value !== "string") return false;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function isTimeKey(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = value.match(/^(\d{2}):(\d{2})$/);
  return Boolean(match && Number(match[1]) <= 23 && Number(match[2]) <= 59);
}

function sanitizeLocalText(value: unknown, maximumLength: number): string {
  return typeof value === "string"
    ? value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069]/g, "").trim().slice(0, maximumLength)
    : "";
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
      title: sanitizeLocalText(item.title, 160),
      completed: item.completed === true,
    }];
  }).slice(0, 50);
}

function normalizeAgendaEvent(value: unknown): AgendaEvent | null {
  if (!isRecord(value)) return null;
  const id = sanitizeLocalText(value.id, 160) || createLocalId();
  const title = sanitizeLocalText(value.title, 240);
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
  const reminderMinutesList = Array.isArray(value.reminderMinutesList)
    ? Array.from(new Set(value.reminderMinutesList.map(Number).filter((minutes) => Number.isFinite(minutes) && minutes >= 0 && minutes <= 10080).map(Math.round))).sort((a, b) => b - a).slice(0, 5)
    : [reminderMinutes];
  const durationMinutes = Number.isFinite(Number(value.durationMinutes)) ? Math.min(1440, Math.max(0, Math.round(Number(value.durationMinutes)))) : 30;
  const location = sanitizeLocalText(value.location, 300);
  const notes = sanitizeLocalText(value.notes, 4000);
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
    reminderMinutes: reminderMinutesList.at(-1) ?? reminderMinutes,
    reminderMinutesList,
    durationMinutes,
    location,
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
  const safeEvents = normalizeAgenda(events).slice(0, 1000);
  const result: AgendaOccurrence[] = [];
  for (const event of safeEvents) {
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
  const project = sanitizeLocalText(value.project, 160) || defaultFocus.project;
  const task = sanitizeLocalText(value.task, 240) || defaultFocus.task;
  if (value.running && value.endsAt) {
    const remainingSeconds = Math.min(durationSeconds, Math.max(0, Math.ceil((value.endsAt - Date.now()) / 1000)));
    if (remainingSeconds === 0) return { project, task, durationMinutes, remainingSeconds: 0, running: false, endsAt: null };
    return { project, task, durationMinutes, remainingSeconds, running: true, endsAt: value.endsAt };
  }
  return { project, task, durationMinutes, remainingSeconds: Math.min(durationSeconds, Math.max(0, Math.round(value.remainingSeconds))), running: false, endsAt: null };
}

export function formatTimer(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function readNotifiedOccurrences(): string[] {
  return readStoredValue<string[]>(AGENDA_NOTIFICATIONS_KEY, (value): value is string[] => Array.isArray(value) && value.every((item) => typeof item === "string"), []);
}


async function showBrowserNotification(title: string, options: NotificationOptions): Promise<boolean> {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return false;
  try {
    if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(title, { ...options, data: { ...(options.data as Record<string, unknown> | undefined), url: "/?view=agenda" } });
    } else {
      const notification = new Notification(title, options);
      notification.onclick = () => window.focus();
    }
    return true;
  } catch {
    return false;
  }
}
function occurrenceTimestamp(occurrence: AgendaOccurrence): number {
  return new Date(`${occurrence.occurrenceDate}T${occurrence.time}:00`).getTime();
}

function icsEscape(value: string): string {
  return sanitizeLocalText(value.replace(/\r\n?/g, "\n"), 4_000)
    .replace(/\\/g, "\\\\")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;")
    .replace(/\n/g, "\\n");
}

function icsUnescape(value: string): string {
  return value.replace(/\\([,;n\\])/g, (_all, char: string) => char === "n" ? "\n" : char);
}

function localDateTimeStamp(dateKey: string, time: string): string {
  return dateKey.replaceAll("-", "") + "T" + time.replace(":", "") + "00";
}

function addMinutesToLocalStamp(dateKey: string, time: string, minutes: number): string {
  const date = new Date(`${dateKey}T${time}:00`);
  date.setMinutes(date.getMinutes() + minutes);
  return `${localDateKey(date).replaceAll("-", "")}T${String(date.getHours()).padStart(2, "0")}${String(date.getMinutes()).padStart(2, "0")}00`;
}

function triggerFromMinutes(minutes: number): string {
  if (minutes % 1440 === 0 && minutes >= 1440) return `-P${minutes / 1440}D`;
  if (minutes % 60 === 0 && minutes >= 60) return `-PT${minutes / 60}H`;
  return minutes === 0 ? "PT0M" : `-PT${minutes}M`;
}

function minutesFromTrigger(value: string): number | null {
  const normalized = value.trim().toUpperCase();
  if (normalized === "PT0M" || normalized === "-PT0M") return 0;
  const day = normalized.match(/^-P(\d+)D$/);
  if (day) return Number(day[1]) * 1440;
  const hour = normalized.match(/^-PT(\d+)H$/);
  if (hour) return Number(hour[1]) * 60;
  const minute = normalized.match(/^-PT(\d+)M$/);
  return minute ? Number(minute[1]) : null;
}

export function exportAgendaICS(events: AgendaEvent[]): string {
  const safeEvents = normalizeAgenda(events).slice(0, 1000);
  const nowStamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//LumaBoard//Calendar & Notifications//PT-BR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:LumaBoard",
  ];
  for (const event of safeEvents) {
    const stamp = localDateTimeStamp(event.date, event.time);
    lines.push(
      "BEGIN:VEVENT",
      `UID:${icsEscape(event.id)}@lumaboard.local`,
      `DTSTAMP:${nowStamp}`,
      `DTSTART:${stamp}`,
      `DTEND:${addMinutesToLocalStamp(event.date, event.time, event.durationMinutes ?? 30)}`,
      `SUMMARY:${icsEscape(event.title)}`,
      `CATEGORIES:${icsEscape(agendaCategoryLabel(event.category))}`,
      `PRIORITY:${event.priority === "high" ? 1 : event.priority === "low" ? 9 : 5}`,
    );
    if (event.location) lines.push(`LOCATION:${icsEscape(event.location)}`);
    if (event.notes) lines.push(`DESCRIPTION:${icsEscape(event.notes)}`);
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
    if (event.skippedDates?.length) {
      lines.push(`EXDATE:${event.skippedDates.map((date) => localDateTimeStamp(date, event.time)).join(",")}`);
    }
    for (const minutes of event.reminderMinutesList?.length ? event.reminderMinutesList : [event.reminderMinutes ?? 0]) {
      lines.push(
        "BEGIN:VALARM",
        `TRIGGER:${triggerFromMinutes(minutes)}`,
        "ACTION:DISPLAY",
        `DESCRIPTION:${icsEscape(event.title)}`,
        "END:VALARM",
      );
    }
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export function importAgendaICS(text: string): AgendaEvent[] {
  if (typeof text !== "string" || new TextEncoder().encode(text).byteLength > 2_000_000) return [];
  const unfold = text.replace(/\r?\n[ \t]/g, "");
  const blocks = (unfold.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g) ?? []).slice(0, 1000);
  const dayMap: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
  const categoryMap: Record<string, AgendaCategory> = {
    pessoal: "personal",
    trabalho: "work",
    saúde: "health",
    saude: "health",
    finanças: "finance",
    financas: "finance",
    estudos: "study",
    outro: "other",
  };
  return blocks.flatMap((block) => {
    const read = (name: string) => block.match(new RegExp(`^${name}(?:;[^:]*)?:(.*)$`, "m"))?.[1]?.trim() ?? "";
    const start = read("DTSTART");
    const match = start.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2}))?/);
    const title = icsUnescape(read("SUMMARY"));
    if (!match || !title) return [];
    const date = `${match[1]}-${match[2]}-${match[3]}`;
    const time = match[4] ? `${match[4]}:${match[5]}` : "09:00";
    const rule = read("RRULE");
    const freq = rule.match(/FREQ=([^;]+)/)?.[1];
    const recurrence: AgendaRecurrence = freq === "DAILY" ? "daily" : freq === "WEEKLY" ? "weekly" : freq === "MONTHLY" ? "monthly" : freq === "YEARLY" ? "yearly" : "once";
    const until = rule.match(/UNTIL=(\d{4})(\d{2})(\d{2})/)?.slice(1, 4).join("-") ?? null;
    const byDay = rule.match(/BYDAY=([^;]+)/)?.[1]?.split(",").map((day) => dayMap[day]).filter((day) => day !== undefined) ?? [];
    const endMatch = read("DTEND").match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})/);
    const startDate = new Date(`${date}T${time}:00`);
    const endDate = endMatch ? new Date(`${endMatch[1]}-${endMatch[2]}-${endMatch[3]}T${endMatch[4]}:${endMatch[5]}:00`) : null;
    const durationMinutes = endDate && !Number.isNaN(endDate.getTime()) ? Math.max(0, Math.round((endDate.getTime() - startDate.getTime()) / 60_000)) : 30;
    const priorityValue = Number(read("PRIORITY"));
    const priority: AgendaPriority = priorityValue > 0 && priorityValue <= 3 ? "high" : priorityValue >= 7 ? "low" : "normal";
    const categoryRaw = icsUnescape(read("CATEGORIES")).split(",")[0].trim().toLowerCase();
    const triggerValues: Array<number | null> = [];
    for (const matchItem of block.matchAll(/^TRIGGER(?:;[^:]*)?:(.*)$/gm) as IterableIterator<RegExpMatchArray>) {
      triggerValues.push(minutesFromTrigger(matchItem[1]));
    }
    const triggers = triggerValues.filter((item): item is number => item !== null && item >= 0 && item <= 10080);
    const reminderMinutesList = Array.from(new Set(triggers.length ? triggers : [0])).sort((a, b) => b - a).slice(0, 5);
    const exDates = read("EXDATE").split(",").flatMap((value) => {
      const item = value.match(/^(\d{4})(\d{2})(\d{2})/);
      return item ? [`${item[1]}-${item[2]}-${item[3]}`] : [];
    });
    const event = normalizeAgendaEvent({
      id: createLocalId(),
      title,
      date,
      time,
      kind: "reminder",
      recurrence,
      category: categoryMap[categoryRaw] ?? "personal",
      color: "moss",
      completedDates: [],
      endDate: until,
      repeatDays: byDay,
      reminderMinutes: reminderMinutesList.at(-1) ?? 0,
      reminderMinutesList,
      durationMinutes,
      location: icsUnescape(read("LOCATION")),
      subtasks: [],
      priority,
      notes: icsUnescape(read("DESCRIPTION")),
      skippedDates: exDates,
    });
    return event ? [event] : [];
  }).slice(0, 1000);
}

export function useLocalWidgets() {
  const [events, setEvents] = useState<AgendaEvent[]>([]);
  const [focus, setFocus] = useState<FocusSession>(defaultFocus);
  const [, setTick] = useState(0);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | "unsupported">("default");
  const [dueEvents, setDueEvents] = useState<AgendaOccurrence[]>([]);
  const [notificationInbox, setNotificationInbox] = useState<LocalNotificationRecord[]>([]);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>(defaultNotificationSettings);

  const persistNotifications = (next: LocalNotificationRecord[], settings = notificationSettings) => {
    const normalized = normalizeNotificationInbox(next, settings);
    setNotificationInbox(normalized);
    writeStoredValue(NOTIFICATION_INBOX_KEY, normalized);
    window.dispatchEvent(new CustomEvent("lumaboard:notifications", { detail: normalized }));
  };

  useEffect(() => {
    const syncAgenda = (event: Event) => {
      if (event instanceof CustomEvent && Array.isArray(event.detail)) setEvents(normalizeAgenda(event.detail));
      else {
        const raw = readStoredValue<unknown[]>(AGENDA_KEY, Array.isArray, []);
        setEvents(normalizeAgenda(raw));
      }
    };
    const syncNotifications = (event: Event) => {
      if (event instanceof CustomEvent && Array.isArray(event.detail)) {
        setNotificationInbox(normalizeNotificationInbox(event.detail, notificationSettings));
      } else {
        const raw = readStoredValue<unknown[]>(NOTIFICATION_INBOX_KEY, Array.isArray, []);
        setNotificationInbox(normalizeNotificationInbox(raw, notificationSettings));
      }
    };
    const syncSettings = () => {
      const raw = readStoredValue<NotificationSettings>(NOTIFICATION_SETTINGS_KEY, (value): value is NotificationSettings => isRecord(value), defaultNotificationSettings);
      setNotificationSettings(normalizeNotificationSettings(raw));
    };
    window.addEventListener("lumaboard:agenda", syncAgenda);
    window.addEventListener("lumaboard:notifications", syncNotifications);
    window.addEventListener("lumaboard:notification-settings", syncSettings);
    window.addEventListener("storage", syncAgenda);
    window.addEventListener("storage", syncNotifications);
    window.addEventListener("storage", syncSettings);
    return () => {
      window.removeEventListener("lumaboard:agenda", syncAgenda);
      window.removeEventListener("lumaboard:notifications", syncNotifications);
      window.removeEventListener("lumaboard:notification-settings", syncSettings);
      window.removeEventListener("storage", syncAgenda);
      window.removeEventListener("storage", syncNotifications);
      window.removeEventListener("storage", syncSettings);
    };
  }, [notificationSettings]);

  useEffect(() => {
    const rawEvents = readStoredValue<unknown[]>(AGENDA_KEY, Array.isArray, []);
    const savedEvents = normalizeAgenda(rawEvents);
    const savedFocus = readStoredValue<FocusSession>(FOCUS_KEY, isFocus, defaultFocus);
    const rawSettings = readStoredValue<NotificationSettings>(NOTIFICATION_SETTINGS_KEY, (value): value is NotificationSettings => isRecord(value), defaultNotificationSettings);
    const savedSettings = normalizeNotificationSettings(rawSettings);
    const savedInbox = normalizeNotificationInbox(readStoredValue<unknown[]>(NOTIFICATION_INBOX_KEY, Array.isArray, []), savedSettings);
    queueMicrotask(() => {
      setEvents(savedEvents);
      setFocus(normalizeFocus(savedFocus));
      setNotificationSettings(savedSettings);
      setNotificationInbox(savedInbox);
      setNotificationPermission(typeof Notification === "undefined" ? "unsupported" : Notification.permission);
    });
    writeStoredValue(AGENDA_KEY, savedEvents);
    writeStoredValue(NOTIFICATION_SETTINGS_KEY, savedSettings);
    writeStoredValue(NOTIFICATION_INBOX_KEY, savedInbox);
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
      const nowMs = now.getTime();
      const today = localDateKey(now);
      const candidates = listOccurrences(events, addDays(today, -1), addDays(today, 8), false);
      const dueMap = new Map<string, AgendaOccurrence>();
      let inbox = normalizeNotificationInbox(readStoredValue<unknown[]>(NOTIFICATION_INBOX_KEY, Array.isArray, []), notificationSettings);
      const notified = new Set(readNotifiedOccurrences());
      let inboxChanged = false;
      let notifiedChanged = false;

      const canShowBrowserNotification =
        notificationSettings.browserNotifications &&
        typeof Notification !== "undefined" &&
        Notification.permission === "granted" &&
        !isWithinQuietHours(now, notificationSettings);

      for (const occurrence of candidates) {
        const dueAt = occurrenceTimestamp(occurrence);
        const offsets = occurrence.reminderMinutesList?.length
          ? occurrence.reminderMinutesList
          : [occurrence.reminderMinutes ?? 0];
        for (const reminderMinutes of offsets) {
          const notifyAt = dueAt - reminderMinutes * 60_000;
          if (nowMs < notifyAt || nowMs > dueAt + 24 * 60 * 60_000) continue;
          dueMap.set(`${occurrence.id}:${occurrence.occurrenceDate}`, occurrence);
          const sourceKey = agendaNotificationSourceKey(occurrence.id, occurrence.occurrenceDate, occurrence.time, reminderMinutes);
          if (notified.has(sourceKey)) continue;
          const record = createAgendaNotificationRecord({
            eventId: occurrence.id,
            occurrenceDate: occurrence.occurrenceDate,
            title: occurrence.title,
            time: occurrence.time,
            reminderMinutes,
            kind: occurrence.kind,
            createdAt: new Date(Math.max(notifyAt, nowMs)).toISOString(),
          });
          if (!inbox.some((item) => item.sourceKey === sourceKey)) {
            inbox = [record, ...inbox];
            inboxChanged = true;
          }
          if (canShowBrowserNotification) {
            void showBrowserNotification(occurrence.kind === "task" ? "Tarefa do LumaBoard" : "Lembrete do LumaBoard", {
              body: `${record.body} · ${occurrence.title}`,
              tag: `lumaboard-${sourceKey}`,
              icon: "/icons/icon-192.png",
            });
          }
          notified.add(sourceKey);
          notifiedChanged = true;
        }
      }

      inbox = inbox.map((item) => {
        if (!item.snoozedUntil || Date.parse(item.snoozedUntil) > nowMs || item.dismissedAt) return item;
        const snoozeKey = `snooze:${item.id}:${item.snoozedUntil}`;
        if (!notified.has(snoozeKey) && canShowBrowserNotification) {
          void showBrowserNotification("Lembrete adiado do LumaBoard", {
            body: `${item.title} · ${item.body}`,
            tag: `lumaboard-${snoozeKey}`,
            icon: "/icons/icon-192.png",
          });
        }
        if (!notified.has(snoozeKey)) {
          notified.add(snoozeKey);
          notifiedChanged = true;
        }
        inboxChanged = true;
        return { ...item, snoozedUntil: null, readAt: null, createdAt: new Date().toISOString() };
      });

      setDueEvents(Array.from(dueMap.values()).sort((a, b) => `${a.occurrenceDate}T${a.time}`.localeCompare(`${b.occurrenceDate}T${b.time}`)));
      if (inboxChanged) {
        const normalized = normalizeNotificationInbox(inbox, notificationSettings);
        setNotificationInbox(normalized);
        writeStoredValue(NOTIFICATION_INBOX_KEY, normalized);
        window.dispatchEvent(new CustomEvent("lumaboard:notifications", { detail: normalized }));
      }
      if (notifiedChanged) writeStoredValue(AGENDA_NOTIFICATIONS_KEY, Array.from(notified).slice(-2000));
    };
    checkAgenda();
    const timer = window.setInterval(checkAgenda, 30_000);
    return () => window.clearInterval(timer);
  }, [events, notificationSettings]);

  const visibleFocus = normalizeFocus(focus);
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
      const completedDates = event.completedDates.includes(occurrenceDate)
        ? event.completedDates.filter((date) => date !== occurrenceDate)
        : [...event.completedDates, occurrenceDate].slice(-800);
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

  const skipOccurrence = (id: string, occurrenceDate: string) => {
    const source = events.find((event) => event.id === id);
    if (!source) return false;
    if (source.recurrence === "once") {
      removeEvent(id);
      return true;
    }
    return updateEvent(id, { skippedDates: Array.from(new Set([...(source.skippedDates ?? []), occurrenceDate])) });
  };

  const updateFollowingOccurrences = (id: string, occurrenceDate: string, patch: Partial<AgendaEvent>) => {
    const source = events.find((event) => event.id === id);
    if (!source || !isDateKey(occurrenceDate)) return false;
    if (source.recurrence === "once" || occurrenceDate <= source.date) return updateEvent(id, { ...patch, date: occurrenceDate });
    const previousEnd = addDays(occurrenceDate, -1);
    const nextSeries = normalizeAgendaEvent({
      ...source,
      ...patch,
      id: createLocalId(),
      date: occurrenceDate,
      completedDates: [],
      skippedDates: [],
      endDate: source.endDate && source.endDate >= occurrenceDate ? source.endDate : null,
    });
    if (!nextSeries) return false;
    const original = normalizeAgendaEvent({ ...source, endDate: previousEnd, id: source.id });
    if (!original) return false;
    persistEvents([...events.map((event) => event.id === id ? original : event), nextSeries]);
    return true;
  };

  const duplicateEvent = (id: string, date?: string) => {
    const source = events.find((event) => event.id === id);
    if (!source) return false;
    const duplicate = normalizeAgendaEvent({
      ...source,
      id: createLocalId(),
      title: `${source.title} (cópia)`,
      date: date && isDateKey(date) ? date : source.date,
      completedDates: [],
      skippedDates: [],
    });
    if (!duplicate) return false;
    persistEvents([...events, duplicate]);
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

  const testNotification = async () => {
    const permission = notificationPermission === "granted" ? "granted" : await requestNotifications();
    if (permission !== "granted" || typeof Notification === "undefined") return false;
    return showBrowserNotification("Teste do LumaBoard", {
      body: "As notificações locais estão funcionando enquanto o aplicativo estiver aberto.",
      tag: `lumaboard-test-${Date.now()}`,
      icon: "/icons/icon-192.png",
    });
  };

  const updateNotificationSettings = (patch: Partial<NotificationSettings>) => {
    const next = normalizeNotificationSettings({ ...notificationSettings, ...patch });
    setNotificationSettings(next);
    writeStoredValue(NOTIFICATION_SETTINGS_KEY, next);
    window.dispatchEvent(new CustomEvent("lumaboard:notification-settings", { detail: next }));
    persistNotifications(notificationInbox, next);
  };

  const markNotificationRead = (id: string) => persistNotifications(notificationInbox.map((item) => item.id === id ? { ...item, readAt: item.readAt ?? new Date().toISOString() } : item));
  const markOccurrenceNotificationsRead = (eventId: string, occurrenceDate: string) => {
    const now = new Date().toISOString();
    persistNotifications(notificationInbox.map((item) => item.eventId === eventId && item.occurrenceDate === occurrenceDate ? { ...item, readAt: item.readAt ?? now } : item));
  };
  const markAllNotificationsRead = () => {
    const now = new Date().toISOString();
    persistNotifications(notificationInbox.map((item) => notificationIsVisible(item) ? { ...item, readAt: item.readAt ?? now } : item));
  };
  const dismissNotification = (id: string) => persistNotifications(notificationInbox.map((item) => item.id === id ? { ...item, dismissedAt: new Date().toISOString(), readAt: item.readAt ?? new Date().toISOString() } : item));
  const clearNotificationHistory = () => persistNotifications([]);
  const snoozeNotification = (id: string, minutes = notificationSettings.defaultSnoozeMinutes) => {
    const snoozedUntil = new Date(Date.now() + Math.max(1, minutes) * 60_000).toISOString();
    persistNotifications(notificationInbox.map((item) => item.id === id ? { ...item, snoozedUntil, readAt: new Date().toISOString() } : item));
  };
  const snoozeOccurrence = (id: string, occurrenceDate: string, minutes = notificationSettings.defaultSnoozeMinutes) => {
    const occurrence = listOccurrences(events.filter((event) => event.id === id), occurrenceDate, occurrenceDate, true)[0];
    if (!occurrence) return false;
    const related = notificationInbox.filter((item) => item.eventId === occurrence.id && item.occurrenceDate === occurrence.occurrenceDate);
    const record = related[0] ?? createAgendaNotificationRecord({
      eventId: occurrence.id,
      occurrenceDate: occurrence.occurrenceDate,
      title: occurrence.title,
      time: occurrence.time,
      reminderMinutes: occurrence.reminderMinutes ?? 0,
      kind: occurrence.kind,
    });
    const snoozedUntil = new Date(Date.now() + Math.max(1, minutes) * 60_000).toISOString();
    persistNotifications([
      { ...record, snoozedUntil, readAt: new Date().toISOString(), dismissedAt: null },
      ...notificationInbox.filter((item) => item.eventId !== occurrence.id || item.occurrenceDate !== occurrence.occurrenceDate),
    ]);
    return true;
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
    const todayEvents = listOccurrences(events, today, today, true);
    const completedThisWeek = listOccurrences(events, addDays(today, -6), today, true).filter((event) => event.completed).length;
    return { upcomingEvents, nextEvent: upcomingEvents[0] ?? null, overdueTasks, todayEvents, completedThisWeek };
  }, [currentMinute, events, today]);

  const visibleNotifications = notificationInbox.filter((item) => notificationIsVisible(item));

  return {
    events,
    upcomingEvents: agendaSummary.upcomingEvents,
    overdueTasks: agendaSummary.overdueTasks,
    todayEvents: agendaSummary.todayEvents,
    completedThisWeek: agendaSummary.completedThisWeek,
    nextEvent: agendaSummary.nextEvent,
    dueEvents,
    notificationPermission,
    notificationInbox: visibleNotifications,
    notificationHistory: notificationInbox,
    unreadNotificationCount: unreadNotificationCount(notificationInbox),
    notificationSettings,
    focus: visibleFocus,
    addEvent,
    updateEvent,
    removeEvent,
    toggleEventCompleted,
    toggleSubtask,
    moveOccurrence,
    skipOccurrence,
    updateFollowingOccurrences,
    duplicateEvent,
    importEvents,
    requestNotifications,
    testNotification,
    updateNotificationSettings,
    markNotificationRead,
    markOccurrenceNotificationsRead,
    markAllNotificationsRead,
    dismissNotification,
    clearNotificationHistory,
    snoozeNotification,
    snoozeOccurrence,
    updateFocus,
    setFocusDuration,
    toggleFocus,
    resetFocus,
    todayKey: today,
  };
}
