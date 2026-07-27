import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
const root = process.cwd();
describe("privacy and legal notice v1.8.1", () => {
  it("publishes the three legal pages", () => {
    for (const file of ["app/termos/page.tsx", "app/privacidade/page.tsx", "app/cookies/page.tsx"]) expect(fs.existsSync(path.join(root, file))).toBe(true);
  });
  it("keeps advertising disabled until a future renewed choice", () => {
    const source = fs.readFileSync(path.join(root, "app/privacy-consent.tsx"), "utf8");
    expect(source).toContain("advertising: false");
    expect(source).toContain("Uma nova escolha será solicitada");
  });
  it("stores consent locally and exposes a reopen control", () => {
    const source = fs.readFileSync(path.join(root, "app/privacy-consent.tsx"), "utf8");
    expect(source).toContain("lumaboard-consent-v1");
    expect(source).toContain("lumaboard:open-privacy");
  });
});
