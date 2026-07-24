import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const desktopCss = readFileSync(new URL("./desktop-shell.css", import.meta.url), "utf8");
const layout = readFileSync(new URL("./layout.tsx", import.meta.url), "utf8");

describe("adaptive desktop shell v1.7.1", () => {
  it("uses the remaining viewport rather than adding sidebar width to 100%", () => {
    expect(desktopCss).toContain("calc(100% - var(--desktop-sidebar-width))");
    expect(desktopCss).not.toContain("width: 100vw");
  });

  it("keeps desktop overrides isolated from mobile navigation", () => {
    expect(desktopCss).toContain("@media (min-width: 901px)");
    expect(desktopCss).toContain("@media (max-width: 900px)");
    expect(layout).toContain('import "./desktop-shell.css"');
  });

  it("reflows overview cards before they can exceed a notebook viewport", () => {
    expect(desktopCss).toContain("max-width: 1120px");
    expect(desktopCss).toContain(".overview-grid");
    expect(desktopCss).toContain(".status-column");
  });
});
