import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import manifest from "./manifest";

describe("PWA assets", () => {
  it("declares install icons and shortcuts", () => {
    const data = manifest();
    expect(data.display).toBe("standalone");
    expect(data.icons?.some((icon) => icon.sizes === "512x512")).toBe(true);
    expect(data.shortcuts?.some((shortcut) => shortcut.url === "/display")).toBe(true);
  });

  it("ships every icon referenced by the manifest", () => {
    const data = manifest();
    for (const icon of data.icons ?? []) {
      const path = resolve(process.cwd(), "public", String(icon.src).replace(/^\//, ""));
      expect(statSync(path).size).toBeGreaterThan(1000);
    }
  });

  it("keeps updates user-controlled", () => {
    const worker = readFileSync(resolve(process.cwd(), "public/sw.js"), "utf8");
    const installStart = worker.indexOf('addEventListener("install"');
    const activateStart = worker.indexOf('addEventListener("activate"');
    const installBlock = worker.slice(installStart, activateStart);
    expect(installBlock).not.toContain("skipWaiting");
    expect(worker).toContain("ALLOWED_MESSAGE_TYPES");
    expect(worker).toContain('type === "SKIP_WAITING"');
    expect(worker).toContain("cachePage");
  });

  it("does not parse generated Next.js HTML to discover static assets", () => {
    const worker = readFileSync(resolve(process.cwd(), "public/sw.js"), "utf8");
    expect(worker).not.toContain("matchAll(/(?:src|href)=");
    expect(worker).toContain('url.pathname.startsWith("/_next/static/")');
  });

  it("returns notification clicks to the agenda", () => {
    const worker = readFileSync(resolve(process.cwd(), "public/sw.js"), "utf8");
    expect(worker).toContain('addEventListener("notificationclick"');
    expect(worker).toContain("clients.openWindow");
    expect(readFileSync(resolve(process.cwd(), "app/local-widgets.ts"), "utf8")).toContain('/?view=agenda');
  });
});
