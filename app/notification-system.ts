import { isRecord } from "./storage";

export type NotificationSource = "agenda" | "system";
export type NotificationSeverity = "info" | "warning" | "critical";

export type LocalNotificationRecord = {
  id: string;
  source: NotificationSource;
  sourceKey: string;
  eventId?: string;
  occurrenceDate?: string;
  title: string;
  body: string;
  severity: NotificationSeverity;
  createdAt: string;
  readAt: string | null;
  dismissedAt: string | null;
  snoozedUntil: string | null;
};

export type NotificationSettings = {
  browserNotifications: boolean;
  quietHoursEnabled: boolean;
  quietStart: string;
  quietEnd: string;
  defaultSnoozeMinutes: number;
  keepHistoryDays: number;
};

export const defaultNotificationSettings: NotificationSettings = {
  browserNotifications: true,
  quietHoursEnabled: false,
  quietStart: "22:00",
  quietEnd: "07:00",
  defaultSnoozeMinutes: 10,
  keepHistoryDays: 30,
};

function isTime(value: unknown): value is string {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function normalizeNotificationSettings(value: unknown): NotificationSettings {
  if (!isRecord(value)) return defaultNotificationSettings;
  const defaultSnoozeMinutes = Number(value.defaultSnoozeMinutes);
  const keepHistoryDays = Number(value.keepHistoryDays);
  return {
    browserNotifications: value.browserNotifications !== false,
    quietHoursEnabled: value.quietHoursEnabled === true,
    quietStart: isTime(value.quietStart) ? value.quietStart : defaultNotificationSettings.quietStart,
    quietEnd: isTime(value.quietEnd) ? value.quietEnd : defaultNotificationSettings.quietEnd,
    defaultSnoozeMinutes: Number.isFinite(defaultSnoozeMinutes)
      ? Math.min(1440, Math.max(1, Math.round(defaultSnoozeMinutes)))
      : defaultNotificationSettings.defaultSnoozeMinutes,
    keepHistoryDays: Number.isFinite(keepHistoryDays)
      ? Math.min(365, Math.max(1, Math.round(keepHistoryDays)))
      : defaultNotificationSettings.keepHistoryDays,
  };
}

export function normalizeNotificationRecord(value: unknown): LocalNotificationRecord | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.id !== "string" ||
    typeof value.sourceKey !== "string" ||
    typeof value.title !== "string" ||
    typeof value.body !== "string" ||
    typeof value.createdAt !== "string" ||
    Number.isNaN(Date.parse(value.createdAt))
  ) return null;
  const source: NotificationSource = value.source === "system" ? "system" : "agenda";
  const severity: NotificationSeverity = value.severity === "critical" || value.severity === "warning" ? value.severity : "info";
  const normalizeOptionalDate = (item: unknown) => typeof item === "string" && !Number.isNaN(Date.parse(item)) ? item : null;
  return {
    id: value.id.slice(0, 240),
    source,
    sourceKey: value.sourceKey.slice(0, 500),
    eventId: typeof value.eventId === "string" ? value.eventId.slice(0, 240) : undefined,
    occurrenceDate: typeof value.occurrenceDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.occurrenceDate) ? value.occurrenceDate : undefined,
    title: value.title.trim().slice(0, 240),
    body: value.body.trim().slice(0, 1000),
    severity,
    createdAt: value.createdAt,
    readAt: normalizeOptionalDate(value.readAt),
    dismissedAt: normalizeOptionalDate(value.dismissedAt),
    snoozedUntil: normalizeOptionalDate(value.snoozedUntil),
  };
}

export function normalizeNotificationInbox(value: unknown, settings = defaultNotificationSettings): LocalNotificationRecord[] {
  if (!Array.isArray(value)) return [];
  const cutoff = Date.now() - settings.keepHistoryDays * 86_400_000;
  return value
    .flatMap((item) => {
      const normalized = normalizeNotificationRecord(item);
      return normalized && Date.parse(normalized.createdAt) >= cutoff ? [normalized] : [];
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 1000);
}

export function isWithinQuietHours(now: Date, settings: NotificationSettings): boolean {
  if (!settings.quietHoursEnabled) return false;
  const minutes = now.getHours() * 60 + now.getMinutes();
  const [startHour, startMinute] = settings.quietStart.split(":").map(Number);
  const [endHour, endMinute] = settings.quietEnd.split(":").map(Number);
  const start = startHour * 60 + startMinute;
  const end = endHour * 60 + endMinute;
  if (start === end) return true;
  if (start < end) return minutes >= start && minutes < end;
  return minutes >= start || minutes < end;
}

export function agendaNotificationSourceKey(eventId: string, occurrenceDate: string, time: string, reminderMinutes: number): string {
  return `${eventId}:${occurrenceDate}:${time}:${reminderMinutes}`;
}

export function createAgendaNotificationRecord(input: {
  eventId: string;
  occurrenceDate: string;
  title: string;
  time: string;
  reminderMinutes: number;
  kind: "task" | "reminder";
  createdAt?: string;
}): LocalNotificationRecord {
  const createdAt = input.createdAt ?? new Date().toISOString();
  const sourceKey = agendaNotificationSourceKey(input.eventId, input.occurrenceDate, input.time, input.reminderMinutes);
  const prefix = input.reminderMinutes > 0
    ? input.reminderMinutes >= 1440
      ? `${Math.round(input.reminderMinutes / 1440)} dia(s) antes`
      : input.reminderMinutes >= 60
        ? `${Math.round(input.reminderMinutes / 60)} hora(s) antes`
        : `${input.reminderMinutes} min antes`
    : `Agora, às ${input.time}`;
  return {
    id: `agenda-${sourceKey}`,
    source: "agenda",
    sourceKey,
    eventId: input.eventId,
    occurrenceDate: input.occurrenceDate,
    title: input.title,
    body: `${prefix} · ${input.kind === "task" ? "Tarefa" : "Lembrete"}`,
    severity: input.kind === "task" ? "warning" : "info",
    createdAt,
    readAt: null,
    dismissedAt: null,
    snoozedUntil: null,
  };
}

export function notificationIsVisible(item: LocalNotificationRecord, now = Date.now()): boolean {
  if (item.dismissedAt) return false;
  if (item.snoozedUntil && Date.parse(item.snoozedUntil) > now) return false;
  return true;
}

export function unreadNotificationCount(items: LocalNotificationRecord[], now = Date.now()): number {
  return items.filter((item) => !item.readAt && notificationIsVisible(item, now)).length;
}
