"use client";

import { useEffect, useMemo, useState } from "react";
import { isRecord, readStoredValue, writeStoredValue } from "./storage";

export type ThemeMode = "paper" | "night" | "oled" | "eink" | "custom";
export type ThemeBackground = "solid" | "gradient" | "image";
export type ThemeFont = "system" | "serif" | "mono";
export type ThemeDensity = "compact" | "comfortable" | "spacious";

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
  radius: number;
  density: ThemeDensity;
  shadowStrength: number;
  autoContrast: boolean;
};

export type ThemeState = {
  version: 3;
  activeThemeId: string;
  profiles: ThemeProfile[];
  layoutThemes: Record<string, string>;
};

export type ThemeBundle = {
  kind: "lumaboard-theme-bundle";
  version: 1;
  exportedAt: string;
  themes: ThemeProfile[];
};

export const THEME_STORAGE_KEY = "lumaboard-theme-v2";
export const MAX_THEME_IMAGE_BYTES = 700_000;
const MAX_THEME_IMAGE_DATA_BYTES = 950_000;

const base = {
  imageData: null,
  fontScale: 1,
  radius: 8,
  density: "comfortable" as ThemeDensity,
  shadowStrength: 0.55,
  autoContrast: true,
};

export const BUILTIN_THEMES: ThemeProfile[] = [
  { ...base, id: "paper", name: "Papel", mode: "paper", accent: "#35513a", surface: "#fbfaf6", text: "#151713", muted: "#5f625b", border: "#cec8bb", backgroundType: "solid", background: "#f2efe7", gradientEnd: "#e7e1d5", font: "system" },
  { ...base, id: "night", name: "Noturno", mode: "night", accent: "#6ee7f2", surface: "#101925", text: "#f4f7fa", muted: "#91a2b6", border: "#213044", backgroundType: "gradient", background: "#080d14", gradientEnd: "#111d2a", font: "system", shadowStrength: 0.8 },
  { ...base, id: "oled", name: "OLED", mode: "oled", accent: "#7df9ff", surface: "#080808", text: "#ffffff", muted: "#a0a0a0", border: "#272727", backgroundType: "solid", background: "#000000", gradientEnd: "#050505", font: "system", radius: 6, shadowStrength: 0.2 },
  { ...base, id: "eink", name: "E-paper", mode: "eink", accent: "#111111", surface: "#f7f5ed", text: "#111111", muted: "#4e4e49", border: "#262626", backgroundType: "solid", background: "#eceae1", gradientEnd: "#f7f5ed", font: "serif", fontScale: 1.05, radius: 2, density: "compact", shadowStrength: 0 },
  { ...base, id: "ocean", name: "Oceano", mode: "custom", accent: "#22d3ee", surface: "#082f49", text: "#ecfeff", muted: "#a5f3fc", border: "#155e75", backgroundType: "gradient", background: "#020617", gradientEnd: "#083344", font: "system", radius: 12, shadowStrength: 0.75 },
  { ...base, id: "forest", name: "Floresta", mode: "custom", accent: "#84cc16", surface: "#19351f", text: "#f7fee7", muted: "#d9f99d", border: "#3f6212", backgroundType: "gradient", background: "#0f1f14", gradientEnd: "#25402a", font: "serif", radius: 10, shadowStrength: 0.65 },
  { ...base, id: "sunset", name: "Pôr do sol", mode: "custom", accent: "#fb7185", surface: "#431a2b", text: "#fff1f2", muted: "#fecdd3", border: "#9f1239", backgroundType: "gradient", background: "#2b1020", gradientEnd: "#7c2d12", font: "system", radius: 14, density: "spacious", shadowStrength: 0.8 },
  { ...base, id: "lavender", name: "Lavanda", mode: "custom", accent: "#8b5cf6", surface: "#faf5ff", text: "#2e1065", muted: "#6b21a8", border: "#d8b4fe", backgroundType: "gradient", background: "#f5f3ff", gradientEnd: "#ede9fe", font: "system", radius: 14, shadowStrength: 0.4 },
];

export const BUILTIN_THEME_IDS = new Set(BUILTIN_THEMES.map((theme) => theme.id));

function validHex(value: unknown, fallback: string): string {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback;
}

function finite(value: unknown, fallback: number, minimum: number, maximum: number): number {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(maximum, Math.max(minimum, number)) : fallback;
}

export function normalizeThemeProfile(value: unknown, fallback = BUILTIN_THEMES[0]): ThemeProfile | null {
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
    fontScale: finite(value.fontScale, fallback.fontScale, 0.85, 1.35),
    radius: Math.round(finite(value.radius, fallback.radius, 0, 24)),
    density: value.density === "compact" || value.density === "spacious" ? value.density : "comfortable",
    shadowStrength: finite(value.shadowStrength, fallback.shadowStrength, 0, 1),
    autoContrast: value.autoContrast !== false,
  };
}

export function createDefaultThemeState(): ThemeState {
  return { version: 3, activeThemeId: "paper", profiles: BUILTIN_THEMES.map((theme) => ({ ...theme })), layoutThemes: {} };
}

export function normalizeThemeState(value: unknown): ThemeState {
  const fallback = createDefaultThemeState();
  if (!isRecord(value) || !Array.isArray(value.profiles)) return fallback;
  const profiles = value.profiles.flatMap((profile) => {
    const normalized = normalizeThemeProfile(profile);
    return normalized ? [normalized] : [];
  });
  for (const builtin of BUILTIN_THEMES) {
    const index = profiles.findIndex((profile) => profile.id === builtin.id);
    if (index === -1) profiles.push({ ...builtin });
    else profiles[index] = { ...builtin, ...profiles[index], id: builtin.id, name: profiles[index].name || builtin.name };
  }
  const ids = new Set(profiles.map((profile) => profile.id));
  const activeThemeId = typeof value.activeThemeId === "string" && ids.has(value.activeThemeId) ? value.activeThemeId : "paper";
  const layoutThemes: Record<string, string> = {};
  if (isRecord(value.layoutThemes)) {
    for (const [layoutId, themeId] of Object.entries(value.layoutThemes)) {
      if (typeof themeId === "string" && ids.has(themeId)) layoutThemes[layoutId] = themeId;
    }
  }
  return { version: 3, activeThemeId, profiles, layoutThemes };
}

export function readThemeState(): ThemeState {
  const legacy = typeof window !== "undefined" ? window.localStorage.getItem("lumaboard-theme") : null;
  const fallback = createDefaultThemeState();
  if (legacy === "night") fallback.activeThemeId = "night";
  return normalizeThemeState(readStoredValue<unknown>(THEME_STORAGE_KEY, isRecord, fallback));
}

export function writeThemeState(state: ThemeState): ThemeState {
  const next = normalizeThemeState(state);
  writeStoredValue(THEME_STORAGE_KEY, next);
  if (typeof window !== "undefined") {
    writeStoredValue("lumaboard-theme", next.activeThemeId === "night" || next.activeThemeId === "oled" ? "night" : "paper");
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

function densityGap(density: ThemeDensity): string {
  return density === "compact" ? "0.78" : density === "spacious" ? "1.18" : "1";
}

function shadowFor(theme: ThemeProfile): string {
  if (theme.shadowStrength <= 0.02) return "none";
  const alpha = (0.06 + theme.shadowStrength * 0.2).toFixed(2);
  const y = Math.round(5 + theme.shadowStrength * 15);
  const blur = Math.round(18 + theme.shadowStrength * 34);
  return `0 ${y}px ${blur}px rgba(0,0,0,${alpha})`;
}

function themeBackground(theme: ThemeProfile, fixed = false): string {
  return theme.backgroundType === "image" && theme.imageData
    ? `linear-gradient(rgba(0,0,0,.12), rgba(0,0,0,.12)), url(${JSON.stringify(theme.imageData)}) center/cover${fixed ? " fixed" : ""}`
    : theme.backgroundType === "gradient"
      ? `linear-gradient(145deg, ${theme.background}, ${theme.gradientEnd})`
      : theme.background;
}

export function applyTheme(profile: ThemeProfile) {
  if (typeof document === "undefined") return;
  const theme = ensureContrast(profile);
  const root = document.documentElement;
  const variables = themeCssVariables(theme);
  root.dataset.lumaboardTheme = theme.mode;
  for (const [key, value] of Object.entries(variables)) root.style.setProperty(key, value);
  root.style.setProperty("--theme-background", themeBackground(theme, true));
  root.style.colorScheme = theme.mode === "night" || theme.mode === "oled" || contrastRatio("#ffffff", theme.background) > contrastRatio("#111111", theme.background) ? "dark" : "light";
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme.background);
}

export function useThemeSystem(layoutId?: string | null) {
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
  const dark = theme.mode === "night" || theme.mode === "oled" || contrastRatio("#ffffff", theme.background) > contrastRatio("#111111", theme.background);
  return {
    "--accent": theme.accent,
    "--accent-strong": theme.accent,
    "--accent-soft": `color-mix(in srgb, ${theme.accent} 14%, transparent)`,
    "--on-accent": contrastRatio("#ffffff", theme.accent) >= contrastRatio("#111111", theme.accent) ? "#ffffff" : "#111111",
    "--surface": theme.surface,
    "--surface-2": theme.surface,
    "--sidebar": theme.surface,
    "--text": theme.text,
    "--ink": theme.text,
    "--text-muted": theme.muted,
    "--ink-muted": theme.muted,
    "--border": theme.border,
    "--line": theme.border,
    "--shell": theme.background,
    "--success": dark ? "#7fe28c" : "#3d6545",
    "--warning": dark ? "#f2b85b" : "#a2672f",
    "--cyan": theme.accent,
    "--amber": dark ? "#f2b85b" : "#a2672f",
    "--eink-paper": "#f4f1e8",
    "--eink-ink": "#182026",
    "--shadow": shadowFor(theme),
    "--theme-background": themeBackground(theme),
    "--theme-font-scale": String(theme.fontScale),
    "--theme-font": theme.font === "serif" ? "Georgia, 'Times New Roman', serif" : theme.font === "mono" ? "ui-monospace, 'Courier New', monospace" : "'Arial Narrow', 'Inter Tight', Inter, Arial, sans-serif",
    "--theme-radius": `${theme.radius}px`,
    "--theme-density": densityGap(theme.density),
  };
}

export function createThemeBundle(themes: ThemeProfile[]): ThemeBundle {
  return { kind: "lumaboard-theme-bundle", version: 1, exportedAt: new Date().toISOString(), themes: themes.map((theme) => ({ ...theme })) };
}

export function parseThemeBundle(value: unknown): ThemeProfile[] {
  if (isRecord(value) && value.kind === "lumaboard-theme-bundle" && Array.isArray(value.themes)) {
    return value.themes.flatMap((theme) => {
      const normalized = normalizeThemeProfile(theme);
      return normalized ? [{ ...normalized, id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, mode: "custom" as const }] : [];
    });
  }
  const single = normalizeThemeProfile(value);
  return single ? [{ ...single, id: `custom-${Date.now()}`, mode: "custom" }] : [];
}
