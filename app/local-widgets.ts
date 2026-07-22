"use client";

import { useEffect, useMemo, useState } from "react";
import { isRecord, readStoredValue, writeStoredValue } from "./storage";

const AGENDA_KEY = "lumaboard-agenda";
const FOCUS_KEY = "lumaboard-focus";

export type AgendaEvent = {
  id: string;
  title: string;
  date: string;
  time: string;
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

function isAgendaEvent(value: unknown): value is AgendaEvent {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.date === "string" &&
    typeof value.time === "string"
  );
}

function isAgenda(value: unknown): value is AgendaEvent[] {
  return Array.isArray(value) && value.every(isAgendaEvent);
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

function localDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

export function useLocalWidgets() {
  const [events, setEvents] = useState<AgendaEvent[]>([]);
  const [focus, setFocus] = useState<FocusSession>(defaultFocus);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const savedEvents = readStoredValue<AgendaEvent[]>(AGENDA_KEY, isAgenda, []);
    const savedFocus = readStoredValue<FocusSession>(FOCUS_KEY, isFocus, defaultFocus);
    queueMicrotask(() => {
      setEvents(savedEvents);
      setFocus(normalizeFocus(savedFocus));
    });
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

  const visibleFocus = useMemo(() => normalizeFocus(focus), [focus, tick]);

  const persistEvents = (next: AgendaEvent[]) => {
    const sorted = [...next].sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
    setEvents(sorted);
    writeStoredValue(AGENDA_KEY, sorted);
  };

  const addEvent = (input: Omit<AgendaEvent, "id">) => {
    const title = input.title.trim();
    if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(input.date) || !/^\d{2}:\d{2}$/.test(input.time)) {
      return false;
    }
    persistEvents([...events, { ...input, title, id: crypto.randomUUID() }]);
    return true;
  };

  const removeEvent = (id: string) => persistEvents(events.filter((event) => event.id !== id));

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
  const upcomingEvents = events.filter(
    (event) => event.date > today || (event.date === today && event.time >= currentTime),
  );
  const nextEvent = upcomingEvents[0] ?? null;

  return {
    events,
    upcomingEvents,
    nextEvent,
    focus: visibleFocus,
    addEvent,
    removeEvent,
    updateFocus,
    setFocusDuration,
    toggleFocus,
    resetFocus,
    todayKey: localDateKey(),
  };
}
