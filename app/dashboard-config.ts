"use client";

import { isRecord, readStoredValue, writeStoredValue } from "./storage";

export const DASHBOARD_STORAGE_KEY = "lumaboard-dashboard-v2";
export const MUSIC_STORAGE_KEY = "lumaboard-music-v1";

export type DashboardWidgetType =
  | "clock"
  | "agenda"
  | "weather"
  | "focus"
  | "news"
  | "anime"
  | "economy"
  | "music";

export type DashboardWidget = {
  id: string;
  type: DashboardWidgetType;
  title: string;
  enabled: boolean;
  colSpan: number;
  rowSpan: number;
  showHeader: boolean;
  bordered: boolean;
  fontScale: number;
  opacity: number;
  background: "surface" | "paper" | "transparent";
};

export type DashboardLayout = {
  id: string;
  name: string;
  columns: 1 | 2 | 3 | 4;
  gap: number;
  background: "paper" | "night" | "eink" | "transparent";
  widgets: DashboardWidget[];
};

export type PlaylistRule = {
  id: string;
  name: string;
  layoutId: string;
  enabled: boolean;
  days: number[];
  startTime: string;
  endTime: string;
  durationSeconds: number;
  order: number;
};

export type DashboardSettings = {
  defaultLayoutId: string;
  randomize: boolean;
  pauseOnInteraction: boolean;
  pauseSeconds: number;
  transition: "fade" | "slide" | "none";
  transitionSeconds: number;
  hideCursor: boolean;
  preventSleep: boolean;
  showStatus: boolean;
  newsCarouselSeconds: number;
  newsSource: "all" | "hacker-news" | "dev-community";
  newsImageOnly: boolean;
};

export type DashboardState = {
  version: 2;
  layouts: DashboardLayout[];
  playlist: PlaylistRule[];
  settings: DashboardSettings;
  updatedAt: string;
};

export type MusicTrack = {
  id: string;
  title: string;
  artist: string;
  album: string;
  genre: string;
  artworkUrl: string | null;
  previewUrl: string | null;
  storeUrl: string;
  spotifySearchUrl: string;
};

export type RadioStation = {
  id: string;
  name: string;
  streamUrl: string;
  homepage: string | null;
  favicon: string | null;
  countryCode: string;
  tags: string[];
  codec: string;
  bitrate: number | null;
};

export type MusicCache = {
  genre: string;
  updatedAt: string;
  tracks: MusicTrack[];
  stations: RadioStation[];
  favorites: string[];
};

const WIDGET_LABELS: Record<DashboardWidgetType, string> = {
  clock: "Relógio",
  agenda: "Agenda",
  weather: "Tempo",
  focus: "Foco",
  news: "Notícias",
  anime: "Anime",
  economy: "Economia",
  music: "Música",
};

function uid(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createWidget(type: DashboardWidgetType, patch: Partial<DashboardWidget> = {}): DashboardWidget {
  return {
    id: uid("widget"),
    type,
    title: WIDGET_LABELS[type],
    enabled: true,
    colSpan: type === "news" || type === "anime" ? 2 : 1,
    rowSpan: type === "news" || type === "anime" ? 2 : 1,
    showHeader: true,
    bordered: true,
    fontScale: 1,
    opacity: 1,
    background: "surface",
    ...patch,
  };
}

function defaultLayouts(): DashboardLayout[] {
  return [
    {
      id: "layout-morning",
      name: "Painel da manhã",
      columns: 3,
      gap: 14,
      background: "paper",
      widgets: [
        createWidget("clock", { colSpan: 1, rowSpan: 1 }),
        createWidget("weather", { colSpan: 1, rowSpan: 1 }),
        createWidget("agenda", { colSpan: 1, rowSpan: 2 }),
        createWidget("news", { colSpan: 2, rowSpan: 2 }),
      ],
    },
    {
      id: "layout-work",
      name: "Painel de trabalho",
      columns: 3,
      gap: 14,
      background: "paper",
      widgets: [
        createWidget("focus", { colSpan: 1, rowSpan: 2 }),
        createWidget("agenda", { colSpan: 1, rowSpan: 2 }),
        createWidget("economy", { colSpan: 1, rowSpan: 1 }),
        createWidget("news", { colSpan: 2, rowSpan: 2 }),
      ],
    },
    {
      id: "layout-anime",
      name: "Painel anime e música",
      columns: 3,
      gap: 14,
      background: "night",
      widgets: [
        createWidget("anime", { colSpan: 2, rowSpan: 2 }),
        createWidget("music", { colSpan: 1, rowSpan: 2 }),
        createWidget("clock", { colSpan: 1 }),
        createWidget("weather", { colSpan: 1 }),
      ],
    },
  ];
}

export function createDefaultDashboardState(): DashboardState {
  const layouts = defaultLayouts();
  return {
    version: 2,
    layouts,
    playlist: [
      {
        id: "rule-morning",
        name: "Manhã",
        layoutId: "layout-morning",
        enabled: true,
        days: [0, 1, 2, 3, 4, 5, 6],
        startTime: "06:00",
        endTime: "09:00",
        durationSeconds: 45,
        order: 0,
      },
      {
        id: "rule-work",
        name: "Trabalho",
        layoutId: "layout-work",
        enabled: true,
        days: [1, 2, 3, 4, 5],
        startTime: "09:00",
        endTime: "18:00",
        durationSeconds: 60,
        order: 1,
      },
      {
        id: "rule-evening",
        name: "Noite",
        layoutId: "layout-anime",
        enabled: true,
        days: [0, 1, 2, 3, 4, 5, 6],
        startTime: "18:00",
        endTime: "23:59",
        durationSeconds: 45,
        order: 2,
      },
    ],
    settings: {
      defaultLayoutId: layouts[0].id,
      randomize: false,
      pauseOnInteraction: true,
      pauseSeconds: 90,
      transition: "fade",
      transitionSeconds: 0.45,
      hideCursor: true,
      preventSleep: true,
      showStatus: true,
      newsCarouselSeconds: 8,
      newsSource: "all",
      newsImageOnly: false,
    },
    updatedAt: new Date().toISOString(),
  };
}

function finite(value: unknown, fallback: number, minimum: number, maximum: number): number {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(maximum, Math.max(minimum, number)) : fallback;
}

function isWidgetType(value: unknown): value is DashboardWidgetType {
  return value === "clock" || value === "agenda" || value === "weather" || value === "focus" || value === "news" || value === "anime" || value === "economy" || value === "music";
}

function normalizeWidget(value: unknown): DashboardWidget | null {
  if (!isRecord(value) || !isWidgetType(value.type)) return null;
  return {
    id: typeof value.id === "string" && value.id ? value.id : uid("widget"),
    type: value.type,
    title: typeof value.title === "string" && value.title.trim() ? value.title.trim() : WIDGET_LABELS[value.type],
    enabled: value.enabled !== false,
    colSpan: Math.round(finite(value.colSpan, 1, 1, 4)),
    rowSpan: Math.round(finite(value.rowSpan, 1, 1, 3)),
    showHeader: value.showHeader !== false,
    bordered: value.bordered !== false,
    fontScale: finite(value.fontScale, 1, 0.75, 1.6),
    opacity: finite(value.opacity, 1, 0.45, 1),
    background: value.background === "paper" || value.background === "transparent" ? value.background : "surface",
  };
}

function normalizeLayout(value: unknown): DashboardLayout | null {
  if (!isRecord(value) || !Array.isArray(value.widgets)) return null;
  const widgets = value.widgets.flatMap((item) => {
    const widget = normalizeWidget(item);
    return widget ? [widget] : [];
  });
  if (widgets.length === 0) return null;
  const columns = Math.round(finite(value.columns, 3, 1, 4)) as 1 | 2 | 3 | 4;
  return {
    id: typeof value.id === "string" && value.id ? value.id : uid("layout"),
    name: typeof value.name === "string" && value.name.trim() ? value.name.trim() : "Painel sem nome",
    columns,
    gap: Math.round(finite(value.gap, 14, 0, 32)),
    background: value.background === "night" || value.background === "eink" || value.background === "transparent" ? value.background : "paper",
    widgets,
  };
}

function normalizeRule(value: unknown, validLayoutIds: Set<string>, order: number): PlaylistRule | null {
  if (!isRecord(value) || typeof value.layoutId !== "string" || !validLayoutIds.has(value.layoutId)) return null;
  const days = Array.isArray(value.days)
    ? Array.from(new Set(value.days.map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)))
    : [0, 1, 2, 3, 4, 5, 6];
  return {
    id: typeof value.id === "string" && value.id ? value.id : uid("rule"),
    name: typeof value.name === "string" && value.name.trim() ? value.name.trim() : "Programação",
    layoutId: value.layoutId,
    enabled: value.enabled !== false,
    days: days.length ? days : [0, 1, 2, 3, 4, 5, 6],
    startTime: typeof value.startTime === "string" && /^\d{2}:\d{2}$/.test(value.startTime) ? value.startTime : "00:00",
    endTime: typeof value.endTime === "string" && /^\d{2}:\d{2}$/.test(value.endTime) ? value.endTime : "23:59",
    durationSeconds: Math.round(finite(value.durationSeconds, 45, 5, 3600)),
    order: Math.round(finite(value.order, order, 0, 999)),
  };
}

export function normalizeDashboardState(value: unknown): DashboardState {
  const fallback = createDefaultDashboardState();
  if (!isRecord(value) || !Array.isArray(value.layouts)) return fallback;
  const layouts = value.layouts.flatMap((item) => {
    const layout = normalizeLayout(item);
    return layout ? [layout] : [];
  });
  if (layouts.length === 0) return fallback;
  const validLayoutIds = new Set(layouts.map((layout) => layout.id));
  const rawPlaylist = Array.isArray(value.playlist) ? value.playlist : [];
  const playlist = rawPlaylist.flatMap((item, index) => {
    const rule = normalizeRule(item, validLayoutIds, index);
    return rule ? [rule] : [];
  });
  const rawSettings = isRecord(value.settings) ? value.settings : {};
  const defaultLayoutId = typeof rawSettings.defaultLayoutId === "string" && validLayoutIds.has(rawSettings.defaultLayoutId)
    ? rawSettings.defaultLayoutId
    : layouts[0].id;
  return {
    version: 2,
    layouts,
    playlist,
    settings: {
      defaultLayoutId,
      randomize: rawSettings.randomize === true,
      pauseOnInteraction: rawSettings.pauseOnInteraction !== false,
      pauseSeconds: Math.round(finite(rawSettings.pauseSeconds, 90, 10, 1800)),
      transition: rawSettings.transition === "slide" || rawSettings.transition === "none" ? rawSettings.transition : "fade",
      transitionSeconds: finite(rawSettings.transitionSeconds, 0.45, 0, 3),
      hideCursor: rawSettings.hideCursor !== false,
      preventSleep: rawSettings.preventSleep !== false,
      showStatus: rawSettings.showStatus !== false,
      newsCarouselSeconds: Math.round(finite(rawSettings.newsCarouselSeconds, 8, 3, 60)),
      newsSource: rawSettings.newsSource === "hacker-news" || rawSettings.newsSource === "dev-community" ? rawSettings.newsSource : "all",
      newsImageOnly: rawSettings.newsImageOnly === true,
    },
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : new Date().toISOString(),
  };
}

export function readDashboardState(): DashboardState {
  const value = readStoredValue<unknown>(DASHBOARD_STORAGE_KEY, (_value): _value is unknown => true, createDefaultDashboardState());
  return normalizeDashboardState(value);
}

export function writeDashboardState(state: DashboardState): DashboardState {
  const next = normalizeDashboardState({ ...state, updatedAt: new Date().toISOString() });
  writeStoredValue(DASHBOARD_STORAGE_KEY, next);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("lumaboard:dashboard", { detail: next }));
  }
  return next;
}

function timeToMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return (Number.isFinite(hours) ? hours : 0) * 60 + (Number.isFinite(minutes) ? minutes : 0);
}

function matchesRule(rule: PlaylistRule, now: Date): boolean {
  if (!rule.enabled || !rule.days.includes(now.getDay())) return false;
  const current = now.getHours() * 60 + now.getMinutes();
  const start = timeToMinutes(rule.startTime);
  const end = timeToMinutes(rule.endTime);
  if (start === end) return true;
  return start < end ? current >= start && current < end : current >= start || current < end;
}

function deterministicShuffle<T>(items: T[], seed: number): T[] {
  const result = [...items];
  let value = seed || 1;
  for (let index = result.length - 1; index > 0; index -= 1) {
    value = (value * 9301 + 49297) % 233280;
    const target = Math.floor((value / 233280) * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

export function activePlaylistRules(state: DashboardState, now = new Date()): PlaylistRule[] {
  const matching = state.playlist
    .filter((rule) => matchesRule(rule, now))
    .sort((a, b) => a.order - b.order);
  if (!state.settings.randomize || matching.length <= 1) return matching;
  const seed = Number(`${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`);
  return deterministicShuffle(matching, seed);
}

export function resolveScheduledLayout(state: DashboardState, now = new Date(), forcedLayoutId?: string | null): DashboardLayout {
  if (forcedLayoutId) {
    const forced = state.layouts.find((layout) => layout.id === forcedLayoutId);
    if (forced) return forced;
  }
  const rules = activePlaylistRules(state, now);
  if (rules.length > 0) {
    const total = rules.reduce((sum, rule) => sum + Math.max(5, rule.durationSeconds), 0);
    const seconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
    let cursor = seconds % total;
    for (const rule of rules) {
      cursor -= Math.max(5, rule.durationSeconds);
      if (cursor < 0) {
        const layout = state.layouts.find((item) => item.id === rule.layoutId);
        if (layout) return layout;
      }
    }
  }
  return state.layouts.find((layout) => layout.id === state.settings.defaultLayoutId) ?? state.layouts[0];
}

export function encodeDashboardState(state: DashboardState): string {
  const json = JSON.stringify(normalizeDashboardState(state));
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeDashboardState(encoded: string): DashboardState | null {
  try {
    const normalized = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return normalizeDashboardState(JSON.parse(new TextDecoder().decode(bytes)) as unknown);
  } catch {
    return null;
  }
}

export function createShareUrl(state: DashboardState, origin: string): string {
  const url = new URL("/display", origin);
  url.hash = `config=${encodeDashboardState(state)}`;
  return url.toString();
}

export function readMusicCache(): MusicCache {
  const fallback: MusicCache = { genre: "pop", updatedAt: "", tracks: [], stations: [], favorites: [] };
  return readStoredValue<MusicCache>(
    MUSIC_STORAGE_KEY,
    (value): value is MusicCache => isRecord(value) && typeof value.genre === "string" && Array.isArray(value.tracks) && Array.isArray(value.stations) && Array.isArray(value.favorites),
    fallback,
  );
}
