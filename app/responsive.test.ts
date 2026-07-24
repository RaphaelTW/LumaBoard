import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("./globals.css", import.meta.url), "utf8");
const mobileCss = readFileSync(new URL("./mobile-shell.css", import.meta.url), "utf8");
const app = readFileSync(new URL("./LumaBoardApp.tsx", import.meta.url), "utf8");
const serviceWorker = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");
const layout = readFileSync(new URL("./layout.tsx", import.meta.url), "utf8");

describe("responsive experience v1.7.0", () => {
  it("declares the real device viewport and safe-area support", () => {
    expect(layout).toContain('width: "device-width"');
    expect(layout).toContain("initialScale: 1");
    expect(layout).toContain('viewportFit: "cover"');
    expect(mobileCss).toContain("env(safe-area-inset-bottom)");
    expect(mobileCss).toContain("inset: auto 0 0 0");
  });

  it("uses five fixed slots without inheriting page width", () => {
    expect(app).toContain("navItems.slice(0, 4)");
    expect(app).toContain("Todos os módulos");
    expect(app).toContain("mobile-module-sheet");
    expect(mobileCss).toContain("grid-template-columns: repeat(5, minmax(0, 1fr))");
    expect(mobileCss).toContain("width: auto !important");
    expect(mobileCss).toContain("contain: layout paint");
  });

  it("opens a real notification quick panel from the bell", () => {
    expect(app).toContain("notificationPanelOpen");
    expect(app).toContain('id="notification-quick-panel"');
    expect(app).toContain("Abrir central completa");
    expect(mobileCss).toContain("notification-quick-panel");
  });

  it("shows the installed version and release summary", () => {
    expect(app).toContain("release-summary");
    expect(app).toContain("APP_VERSION");
    expect(app).toContain("CHANGELOG[0]");
  });

  it("bumps the PWA cache so fixed styles reach installed apps", () => {
    expect(serviceWorker).toContain('const VERSION = "1.7.0";');
  });

  it("keeps the legacy stylesheet parseable while the mobile shell overrides it last", () => {
    expect(css).toContain(".mobile-nav");
    expect(layout.indexOf('import "./globals.css"')).toBeLessThan(layout.indexOf('import "./mobile-shell.css"'));
  });
});
