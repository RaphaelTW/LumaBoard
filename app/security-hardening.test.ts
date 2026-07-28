import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { migrateAutomationState } from "./automation";
import { decodeDashboardState, encodeDashboardState, normalizeDashboardState } from "./dashboard-config";
import { parseSafeJsonText } from "./import-security";
import { exportAgendaICS, importAgendaICS } from "./local-widgets";
import { normalizeThemeProfile } from "./theme-system";
import { safeExternalImageUrl, safeExternalUrl } from "./url-security";

const nextConfig = readFileSync(new URL("../next.config.ts", import.meta.url), "utf8");
const netlify = readFileSync(new URL("../netlify.toml", import.meta.url), "utf8");
const serviceWorker = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");
const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string; allowScripts?: Record<string, boolean>; scripts?: Record<string, string> };

function basicTheme(imageData: string | null) {
  return { id: "custom", name: "Teste", mode: "custom", accent: "#35513a", surface: "#ffffff", text: "#111111", muted: "#555555", border: "#cccccc", backgroundType: "image", background: "#ffffff", gradientEnd: "#eeeeee", imageData, font: "system", fontScale: 1, radius: 8, density: "comfortable", shadowStrength: 0.5, autoContrast: true };
}

describe("security boundaries v1.8.8", () => {
  it("rejects unsafe external URLs and private destinations", () => {
    expect(safeExternalUrl("javascript:alert(1)")).toBe("");
    expect(safeExternalUrl("http://example.com")).toBe("");
    expect(safeExternalUrl("https://127.0.0.1/test")).toBe("");
    expect(safeExternalUrl("https://[::1]/test")).toBe("");
    expect(safeExternalUrl("https://[fc00::1]/test")).toBe("");
    expect(safeExternalUrl("https://[2001:db8::1]/test")).toBe("");
    expect(safeExternalUrl("https://user:pass@example.com")).toBe("");
    expect(safeExternalUrl("https://example.com:8443")).toBe("");
    expect(safeExternalUrl("https://example.com/path")).toBe("https://example.com/path");
    expect(safeExternalImageUrl("https://evil.example/image.png")).toBe("");
    expect(safeExternalImageUrl("https://covers.openlibrary.org/b/id/1-M.jpg")).toContain("covers.openlibrary.org");
  });

  it("bounds JSON imports and blocks prototype-pollution keys", () => {
    expect(() => parseSafeJsonText('{"__proto__":{"polluted":true}}')).toThrow();
    expect(() => parseSafeJsonText(JSON.stringify({ items: Array.from({ length: 6000 }, (_, index) => index) }))).toThrow();
    expect(parseSafeJsonText('{"safe":true}')).toEqual({ safe: true });
  });

  it("rejects active SVG theme payloads", () => {
    const svg = "data:image/svg+xml;base64," + Buffer.from('<svg onload="alert(1)"></svg>').toString("base64");
    expect(normalizeThemeProfile(basicTheme(svg))?.imageData).toBeNull();
    expect(normalizeThemeProfile(basicTheme("data:image/png;base64,iVBORw0KGgo="))?.imageData).toContain("data:image/png");
  });

  it("caps shared dashboards and round-trips normalized data", () => {
    const raw = { version: 2, layouts: Array.from({ length: 80 }, (_, index) => ({ id: `layout-${index}`, name: `Painel ${index}`, columns: 3, gap: 14, background: "paper", widgets: Array.from({ length: 100 }, (__, widget) => ({ id: `widget-${widget}`, type: "clock", title: "Relógio", enabled: true, colSpan: 1, rowSpan: 1, showHeader: true, bordered: true, fontScale: 1, opacity: 1, background: "surface" })) })), playlist: [], settings: {}, updatedAt: new Date().toISOString() };
    const normalized = normalizeDashboardState(raw);
    expect(normalized.layouts).toHaveLength(32);
    expect(normalized.layouts[0].widgets).toHaveLength(48);
    expect(decodeDashboardState(encodeDashboardState(normalized))?.layouts).toHaveLength(32);
  });

  it("normalizes automation imports to the single supported rule", () => {
    const state = migrateAutomationState({ version: 999, rules: [{ id: "rain-alert", name: "x".repeat(500), trigger: "x", action: "x", enabled: true, cooldownMinutes: -50, lastEvaluatedAt: "bad", lastExecutedAt: null, lastSignature: "x".repeat(500), config: { threshold: 500 } }, { id: "arbitrary", name: "x", trigger: "x", action: "x", enabled: true, cooldownMinutes: 1, config: { threshold: 1 } }], history: Array.from({ length: 500 }, (_, index) => ({ id: `h-${index}`, ruleId: "rain-alert", message: "ok", createdAt: "2026-07-28T12:00:00.000Z", value: 80 })) });
    expect(state.rules).toHaveLength(1);
    expect(state.rules[0].id).toBe("rain-alert");
    expect(state.rules[0].config.threshold).toBe(100);
    expect(state.rules[0].cooldownMinutes).toBe(5);
    expect(state.history).toHaveLength(200);
  });

  it("prevents ICS line injection and rejects invalid dates", () => {
    const text = exportAgendaICS([{ id: "safe", title: "Reunião\r\nATTENDEE:mailto:evil@example.com", date: "2026-07-28", time: "09:00", kind: "reminder", recurrence: "once", category: "work", color: "moss", completedDates: [], notes: "Linha 1\r\nORGANIZER:evil", reminderMinutesList: [0] }]);
    expect(text).not.toMatch(/\r\nATTENDEE:/);
    expect(text).not.toMatch(/\r\nORGANIZER:/);
    expect(importAgendaICS("BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nDTSTART:20260231T250000\r\nSUMMARY:Inválido\r\nEND:VEVENT\r\nEND:VCALENDAR")).toHaveLength(0);
  });

  it("ships production CSP, bounded service worker and supply-chain gates", () => {
    expect(packageJson.version).toBe("1.8.8");
    expect(netlify).not.toContain("unsafe-eval");
    for (const source of [nextConfig, netlify]) {
      expect(source).toContain("object-src 'none'");
      expect(source).toContain("frame-ancestors 'none'");
      expect(source).toContain("script-src-attr 'none'");
      expect(source).toContain("Strict-Transport-Security");
    }
    expect(serviceWorker).toContain("CACHE_LIMITS");
    expect(serviceWorker).toContain("CACHE_MAX_BYTES");
    expect(readFileSync(new URL("./api/public/security.ts", import.meta.url), "utf8")).toContain("rejectCrossSiteRequest");
    expect(serviceWorker).toContain("cacheControlDisallowsStorage");
    expect(serviceWorker).toContain("ALLOWED_MESSAGE_TYPES");
    expect(packageJson.allowScripts).toEqual({ esbuild: true, sharp: true, "unrs-resolver": true });
    expect(packageJson.scripts?.["security:scan"]).toBeTruthy();
  });
});
