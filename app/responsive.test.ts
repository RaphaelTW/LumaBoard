import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("./globals.css", import.meta.url), "utf8");
const mobileCss = readFileSync(new URL("./mobile-shell.css", import.meta.url), "utf8");
const desktopCss = readFileSync(new URL("./desktop-shell.css", import.meta.url), "utf8");
const app = readFileSync(new URL("./LumaBoardApp.tsx", import.meta.url), "utf8");
const shell = readFileSync(new URL("./app-shell-components.tsx", import.meta.url), "utf8");
const overview = readFileSync(new URL("./overview-module.tsx", import.meta.url), "utf8");
const serviceWorker = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");
const layout = readFileSync(new URL("./layout.tsx", import.meta.url), "utf8");

describe("responsive experience v1.8.7", () => {
  it("declares the real device viewport and safe-area support", () => {
    expect(layout).toContain('width: "device-width"');
    expect(layout).toContain("initialScale: 1");
    expect(layout).toContain('viewportFit: "cover"');
    expect(mobileCss).toContain("env(safe-area-inset-bottom)");
    expect(mobileCss).toContain("inset: auto 0 0 0");
  });

  it("uses five fixed mobile slots without inheriting page width", () => {
    expect(app).toContain("navItems.slice(0, 4)");
    expect(app).toContain("Todos os módulos");
    expect(app).toContain("mobile-module-sheet");
    expect(mobileCss).toContain("grid-template-columns: repeat(5, minmax(0, 1fr))");
    expect(mobileCss).toContain("width: auto !important");
    expect(mobileCss).toContain("contain: layout paint");
  });

  it("discounts the fixed sidebar from the desktop content viewport", () => {
    expect(desktopCss).toContain("--desktop-sidebar-width: 236px");
    expect(desktopCss).toContain("width: calc(100% - var(--desktop-sidebar-width)) !important");
    expect(desktopCss).toContain("margin-left: var(--desktop-sidebar-width) !important");
    expect(desktopCss).toContain("overflow-x: clip");
  });

  it("adapts notebook-sized desktop layouts instead of clipping them", () => {
    expect(desktopCss).toContain("@media (min-width: 901px) and (max-width: 1400px)");
    expect(desktopCss).toContain("--desktop-sidebar-width: 82px");
    expect(desktopCss).toContain("@media (min-width: 901px) and (max-width: 1120px)");
    expect(desktopCss).toContain("grid-template-columns: minmax(0, 1fr)");
    expect(desktopCss).toContain("grid-template-columns: repeat(2, minmax(0, 1fr))");
  });

  it("loads the desktop override after the legacy and mobile stylesheets", () => {
    const globalIndex = layout.indexOf('import "./globals.css"');
    const mobileIndex = layout.indexOf('import "./mobile-shell.css"');
    const desktopIndex = layout.indexOf('import "./desktop-shell.css"');
    expect(globalIndex).toBeGreaterThanOrEqual(0);
    expect(globalIndex).toBeLessThan(mobileIndex);
    expect(mobileIndex).toBeLessThan(desktopIndex);
    expect(css).toContain(".overview-grid");
  });

  it("opens a real notification quick panel from the bell", () => {
    expect(app).toContain("notificationPanelOpen");
    expect(app).toContain("NotificationQuickPanel");
    expect(shell).toContain('id="notification-quick-panel"');
    expect(shell).toContain("Abrir central completa");
  });

  it("shows the installed version and release summary", () => {
    expect(app).toContain("OverviewModule");
    expect(overview).toContain("release-summary");
    expect(overview).toContain("APP_VERSION");
    expect(overview).toContain("CHANGELOG[0]");
  });

  it("bumps the PWA cache so corrected styles reach installed apps", () => {
    expect(serviceWorker).toContain('const VERSION = "1.8.7";');
  });
});
