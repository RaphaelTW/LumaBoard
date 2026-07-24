import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("./globals.css", import.meta.url), "utf8");
const app = readFileSync(new URL("./LumaBoardApp.tsx", import.meta.url), "utf8");
const serviceWorker = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");

describe("responsive experience v1.6.1", () => {
  it("keeps the mobile navigation complete and horizontally scrollable", () => {
    expect(app).toContain("{navItems.map(");
    expect(app).not.toContain("navItems.slice(0, 5)");
    expect(css).toContain("overflow-x: auto;");
    expect(css).toContain("scroll-snap-type: x proximity;");
  });

  it("provides compact phone and tablet breakpoints", () => {
    expect(css).toContain("@media (max-width: 900px)");
    expect(css).toContain("@media (max-width: 520px)");
    expect(css).toContain("@media (max-width: 340px)");
    expect(css).toContain("env(safe-area-inset-bottom)");
  });

  it("bumps the PWA cache so responsive styles reach installed apps", () => {
    expect(serviceWorker).toContain('const VERSION = "1.6.1";');
  });
});
