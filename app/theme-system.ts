"use client";

import { useEffect, useMemo, useState } from "react";
import { isRecord, readStoredValue, writeStoredValue } from "./storage";

export type ThemeMode = "paper" | "night" | "oled" | "eink" | "custom";
export type ThemeBackground = "solid" | "gradient" | "image";
export type ThemeFont = "system" | "serif" | "mono";

export type ThemeProfile = {
  id: string;
  name: string;
  mode: ThemeMode;
  accent: string;
  surface: string;
  text: string;
  muted: string;
  border: string;
  backgroundType: ThemeBackground;
  background: string;
  gradientEnd: string;
  imageData: string | null;
  font: ThemeFont;
  fontScale: number;
  autoContrast: boolean;
};

export type ThemeState = {
  version: 2;
  activeThemeId: string;
  profiles: ThemeProfile[];
  layoutThemes: Record<string, string>;
};

export const THEME_STORAGE_KEY = "lumaboard-theme-v2";
export const MAX_THEME_IMAGE_BYTES = 700_000;
const MAX_THEME_IMAGE_DATA_BYTES = 950_000;

export const BUILTIN_THEMES: ThemeProfile[] = [
  { id: "paper", name: "Papel", mode: "paper", accent: "#35513a", surface: "#fbfaf6", text: "#151713", muted: "#5f625b", border: "#cec8bb", backgroundType: "solid", background: "#f2efe7", gradientEnd: "#e7e1d5", imageData: null, font: "system", fontScale: 1, autoContrast: true },
  { id: "night", name: "Noturno", mode: "night", accent: "#6ee7f2", surface: "#101925", text: "#f4f7fa", muted: "#91a2b6", border: "#213044", backgroundType: "gradient", background: "#080d14", gradientEnd: "#111d2a", imageData: null, font: "system", fontScale: 1, autoContrast: true },
  { id: "oled", name: "OLED", mode: "oled", accent: "#7df9ff", surface: "#080808", text: "#ffffff", muted: "#a0a0a0", border: "#272727", backgroundType: "solid", background: "#000000", gradientEnd: "#050505", imageData: null, font: "system", fontScale: 1, autoContrast: true },
  { id: "eink", name: "E-paper", mode: "eink", accent: "#111111", surface: "#f7f5ed", text: "#111111", muted: "#4e4e49", border: "#262626", backgroundType: "solid", background: "#eceae1", gradientEnd: "#f7f5ed", imageData: null, font: "serif", fontScale: 1.05, autoContrast: true },
];

function validHex(value: unknown, fallback: string): string {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback;
}

function normalizeProfile(value: unknown, fallback = BUILTIN_THEMES[0]): ThemeProfile | null {
  if (!isRecord(value)) return null;
  const imageData = typeof value.imageData === "string" && value.imageData.startsWith("data:image/") && new TextEncoder().encode(value.imageData).byteLength <= MAX_THEME_IMAGE_DATA_BYTES ? value.imageData : null;
  return {
    id: typeof value.id === "string" && value.id ? value.id : `theme-${Date.now()}`,
    name: typeof value.name === "string" && value.name.trim() ? value.name.trim().slice(0, 60) : "Tema personalizado",
    mode: value.mode === "night" || value.mode === "oled" || value.mode === "eink" || value.mode === "custom" ? value.mode : "paper",
    accent: validHex(value.accent, fallback.accent),
    surface: validHex(value.surface, fallback.surface),
    text: validHex(value.text, fallback.text),
    muted: validHex(value.muted, fallback.muted),
    border: validHex(value.border, fallback.border),
    backgroundType: value.backgroundType === "gradient" || value.backgroundType === "image" ? value.backgroundType : "solid",
    background: validHex(value.background, fallback.background),
    gradientEnd: validHex(value.gradientEnd, fallback.gradientEnd),
    imageData,
    font: value.font === "serif" || value.font === "mono" ? value.font : "system",
    fontScale: Math.min(1.35, Math.max(0.85, Number(value.fontScale) || 1)),
    autoContrast: value.autoContrast !== false,
  };
}

export function createDefaultThemeState(): ThemeState {
  return { version: 2, activeThemeId: "paper", profiles: BUILTIN_THEMES.map((theme) => ({ ...theme })), layoutThemes: {} };
}

export function normalizeThemeState(value: unknown): ThemeState {
  const fallback = createDefaultThemeState();
  if (!isRecord(value) || !Array.isArray(value.profiles)) return fallback;
  const profiles = value.profiles.flatMap((profile) => {
    const normalized = normalizeProfile(profile);
    return normalized ? [normalized] : [];
  });
  for (const builtin of BUILTIN_THEMES) {
    if (!profiles.some((profile) => profile.id === builtin.id)) profiles.push({ ...builtin });
  }
  const ids = new Set(profiles.map((profile) => profile.id));
  const activeThemeId = typeof value.activeThemeId === "string" && ids.has(value.activeThemeId) ? value.activeThemeId : "paper";
  const layoutThemes: Record<string, string> = {};
  if (isRecord(value.layoutThemes)) {
    for (const [layoutId, themeId] of Object.entries(value.layoutThemes)) {
      if (typeof themeId === "string" && ids.has(themeId)) layoutThemes[layoutId] = themeId;
    }
  }
  return { version: 2, activeThemeId, profiles, layoutThemes };
}

export function readThemeState(): ThemeState {
  const legacy = typeof window !== "undefined" ? window.localStorage.getItem("lumaboard-theme") : null;
  const fallback = createDefaultThemeState();
  if (legacy === "night") fallback.activeThemeId = "night";
  return normalizeThemeState(readStoredValue<unknown>(THEME_STORAGE_KEY, (_value): _value is unknown => true, fallback));
}

export function writeThemeState(state: ThemeState): ThemeState {
  const next = normalizeThemeState(state);
  writeStoredValue(THEME_STORAGE_KEY, next);
  if (typeof window !== "undefined") {
    window.localStorage.setItem("lumaboard-theme", next.activeThemeId === "night" || next.activeThemeId === "oled" ? "night" : "paper");
    window.dispatchEvent(new CustomEvent("lumaboard:theme", { detail: next }));
  }
  return next;
}

function luminance(hex: string): number {
  const rgb = [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16) / 255).map((value) => value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}

export function contrastRatio(first: string, second: string): number {
  const a = luminance(first);
  const b = luminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

export function ensureContrast(profile: ThemeProfile): ThemeProfile {
  if (!profile.autoContrast || contrastRatio(profile.text, profile.background) >= 4.5) return profile;
  const whiteRatio = contrastRatio("#ffffff", profile.background);
  const blackRatio = contrastRatio("#111111", profile.background);
  return { ...profile, text: whiteRatio > blackRatio ? "#ffffff" : "#111111", muted: whiteRatio > blackRatio ? "#c4c4c4" : "#4a4a4a" };
}

export function applyTheme(profile: ThemeProfile) {
  if (typeof document === "undefined") return;
  const theme = ensureContrast(profile);
  const root = document.documentElement;
  root.dataset.lumaboardTheme = theme.mode;
  root.style.setProperty("--accent", theme.accent);
  root.style.setProperty("--accent-strong", theme.accent);
  root.style.setProperty("--accent-soft", `color-mix(in srgb, ${theme.accent} 14%, transparent)`);
  root.style.setProperty("--on-accent", contrastRatio("#ffffff", theme.accent) >= contrastRatio("#111111", theme.accent) ? "#ffffff" : "#111111");
  root.style.setProperty("--surface", theme.surface);
  root.style.setProperty("--surface-2", theme.surface);
  root.style.setProperty("--sidebar", theme.surface);
  root.style.setProperty("--text", theme.text);
  root.style.setProperty("--ink", theme.text);
  root.style.setProperty("--text-muted", theme.muted);
  root.style.setProperty("--ink-muted", theme.muted);
  root.style.setProperty("--border", theme.border);
  root.style.setProperty("--line", theme.border);
  root.style.setProperty("--shell", theme.background);
  const dark = theme.mode === "night" || theme.mode === "oled";
  root.style.setProperty("--success", dark ? "#7fe28c" : "#3d6545");
  root.style.setProperty("--warning", dark ? "#f2b85b" : "#a2672f");
  root.style.setProperty("--cyan", theme.accent);
  root.style.setProperty("--amber", dark ? "#f2b85b" : "#a2672f");
  root.style.setProperty("--eink-paper", "#f4f1e8");
  root.style.setProperty("--eink-ink", "#182026");
  root.style.setProperty("--shadow", dark ? "0 18px 50px rgba(0,0,0,.18)" : "0 10px 30px rgba(21,23,19,.055)");
  root.style.setProperty("--theme-font-scale", String(theme.fontScale));
  root.style.setProperty("--theme-font", theme.font === "serif" ? "Georgia, 'Times New Roman', serif" : theme.font === "mono" ? "ui-monospace, 'Courier New', monospace" : "'Arial Narrow', 'Inter Tight', Inter, Arial, sans-serif");
  const background = theme.backgroundType === "image" && theme.imageData
    ? `linear-gradient(rgba(0,0,0,.12), rgba(0,0,0,.12)), url(${JSON.stringify(theme.imageData)}) center/cover fixed`
    : theme.backgroundType === "gradient"
      ? `linear-gradient(145deg, ${theme.background}, ${theme.gradientEnd})`
      : theme.background;
  root.style.setProperty("--theme-background", background);
  root.style.colorScheme = theme.mode === "night" || theme.mode === "oled" ? "dark" : "light";
  const meta = document.querySelector('meta[name="theme-color"]');
  meta?.setAttribute("content", theme.background);
}

export function useThemeSystem(layoutId?: string | null) {
  const [state, setState] = useState(createDefaultThemeState);
  useEffect(() => {
    const sync = (event?: Event) => {
      const next = event instanceof CustomEvent ? normalizeThemeState(event.detail) : readThemeState();
      setState(next);
    };
    queueMicrotask(() => sync());
    window.addEventListener("lumaboard:theme", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("lumaboard:theme", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  const themeId = layoutId && state.layoutThemes[layoutId] ? state.layoutThemes[layoutId] : state.activeThemeId;
  const profile = useMemo(() => state.profiles.find((item) => item.id === themeId) ?? BUILTIN_THEMES[0], [state, themeId]);
  useEffect(() => applyTheme(profile), [profile]);
  const persist = (next: ThemeState) => setState(writeThemeState(next));
  return { state, profile, persist };
}

export function useThemeForLayout(layoutId: string) {
  const [state, setState] = useState(createDefaultThemeState);
  useEffect(() => {
    const sync = (event?: Event) => setState(event instanceof CustomEvent ? normalizeThemeState(event.detail) : readThemeState());
    queueMicrotask(() => sync());
    window.addEventListener("lumaboard:theme", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("lumaboard:theme", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  const themeId = state.layoutThemes[layoutId] ?? state.activeThemeId;
  return ensureContrast(state.profiles.find((item) => item.id === themeId) ?? BUILTIN_THEMES[0]);
}

export function themeCssVariables(profile: ThemeProfile): Record<string, string> {
  const theme = ensureContrast(profile);
  const background = theme.backgroundType === "image" && theme.imageData
    ? `linear-gradient(rgba(0,0,0,.12), rgba(0,0,0,.12)), url(${JSON.stringify(theme.imageData)}) center/cover`
    : theme.backgroundType === "gradient"
      ? `linear-gradient(145deg, ${theme.background}, ${theme.gradientEnd})`
      : theme.background;
  return {
    "--accent": theme.accent,
    "--accent-strong": theme.accent,
    "--accent-soft": `color-mix(in srgb, ${theme.accent} 14%, transparent)`,
    "--on-accent": contrastRatio("#ffffff", theme.accent) >= contrastRatio("#111111", theme.accent) ? "#ffffff" : "#111111",
    "--surface": theme.surface,
    "--surface-2": theme.surface,
    "--sidebar": theme.surface,
    "--text": theme.text,
    "--text-muted": theme.muted,
    "--border": theme.border,
    "--shell": theme.background,
    "--success": theme.mode === "night" || theme.mode === "oled" ? "#7fe28c" : "#3d6545",
    "--warning": theme.mode === "night" || theme.mode === "oled" ? "#f2b85b" : "#a2672f",
    "--cyan": theme.accent,
    "--amber": theme.mode === "night" || theme.mode === "oled" ? "#f2b85b" : "#a2672f",
    "--eink-paper": "#f4f1e8",
    "--eink-ink": "#182026",
    "--shadow": theme.mode === "night" || theme.mode === "oled" ? "0 18px 50px rgba(0,0,0,.18)" : "0 10px 30px rgba(21,23,19,.055)",
    "--theme-background": background,
    "--theme-font-scale": String(theme.fontScale),
    "--theme-font": theme.font === "serif" ? "Georgia, 'Times New Roman', serif" : theme.font === "mono" ? "ui-monospace, 'Courier New', monospace" : "'Arial Narrow', 'Inter Tight', Inter, Arial, sans-serif",
  };
}
