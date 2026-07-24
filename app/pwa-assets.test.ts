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
    const installBlock = worker.slice(worker.indexOf('addEventListener("install"'), worker.indexOf('addEventListener("activate"'));
    expect(installBlock).not.toContain("skipWaiting");
    expect(worker).toContain('event.data?.type === "SKIP_WAITING"');
    expect(worker).toContain("cachePageWithAssets");
  });
});
