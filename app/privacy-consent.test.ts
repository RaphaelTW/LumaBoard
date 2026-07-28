import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
const root = process.cwd();
describe("privacy and legal notice v1.8.7", () => {
  it("publishes the three legal pages", () => {
    for (const file of ["app/termos/page.tsx", "app/privacidade/page.tsx", "app/cookies/page.tsx"]) expect(fs.existsSync(path.join(root, file))).toBe(true);
  });
  it("keeps advertising disabled until a future renewed choice", () => {
    const source = fs.readFileSync(path.join(root, "app/privacy-consent.tsx"), "utf8");
    const preferences = fs.readFileSync(path.join(root, "app/privacy-preferences.ts"), "utf8");
    expect(preferences).toContain("advertising: false");
    expect(source).toContain("Uma nova escolha será solicitada");
  });
  it("stores consent locally and exposes a reopen control", () => {
    const source = fs.readFileSync(path.join(root, "app/privacy-consent.tsx"), "utf8");
    const preferences = fs.readFileSync(path.join(root, "app/privacy-preferences.ts"), "utf8");
    expect(preferences).toContain("lumaboard-consent-v1");
    expect(source).toContain("lumaboard:open-privacy");
  });

  it("records an optional legal acknowledgement without making usage mandatory", () => {
    const source = fs.readFileSync(path.join(root, "app/privacy-consent.tsx"), "utf8");
    const preferences = fs.readFileSync(path.join(root, "app/privacy-preferences.ts"), "utf8");
    expect(source).toContain("Li e estou ciente");
    expect(preferences).toContain("lumaboard-legal-acceptance-v1");
    expect(source).toContain("acknowledgedAt");
    expect(source).not.toContain("Aceito os termos");
  });

  it("blocks optional external calls before the network layer when disabled", () => {
    const preferences = fs.readFileSync(path.join(root, "app/privacy-preferences.ts"), "utf8");
    const publicData = fs.readFileSync(path.join(root, "app/public-data.ts"), "utf8");
    const weather = fs.readFileSync(path.join(root, "app/weather.ts"), "utf8");
    const music = fs.readFileSync(path.join(root, "app/music-module.tsx"), "utf8");
    const explorer = fs.readFileSync(path.join(root, "app/public-explorer.tsx"), "utf8");
    expect(preferences).toContain("hasExternalContentConsent");
    expect(preferences).toContain("externalContent === true");
    expect(publicData.indexOf("hasExternalContentConsent()")).toBeLessThan(publicData.indexOf("const payload = await fetchSummary"));
    expect(weather.indexOf("hasExternalContentConsent()")).toBeLessThan(weather.indexOf("const location = await resolveLocation"));
    expect(music.indexOf("hasExternalContentConsent()")).toBeLessThan(music.indexOf("fetch(`/api/public/music"));
    expect(explorer.indexOf("hasExternalContentConsent()")).toBeLessThan(explorer.indexOf("fetch(url"));
  });

  it("keeps cached local data visible while hiding optional external media and links", () => {
    const panel = fs.readFileSync(path.join(root, "app/public-data-panel.tsx"), "utf8");
    const music = fs.readFileSync(path.join(root, "app/music-module.tsx"), "utf8");
    expect(panel).toContain("Conteúdo externo desativado; usando somente cache local");
    expect(panel).toContain("externalContentAllowed && active.imageUrl");
    expect(music).toContain("As músicas favoritas e o cache local continuam disponíveis");
    expect(music).toContain("externalContentAllowed && track.artworkUrl");
  });
});
