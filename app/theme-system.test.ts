import { describe, expect, it } from "vitest";
import { BUILTIN_THEMES, contrastRatio, createThemeBundle, ensureContrast, normalizeThemeState, parseThemeBundle, themeCssVariables } from "./theme-system";

describe("theme system v1.8.0", () => {
  it("restores all official themes when imported data is incomplete", () => {
    const state = normalizeThemeState({ version: 2, activeThemeId: "custom", profiles: [{ id: "custom", name: "Custom", background: "#ffffff", text: "#111111" }], layoutThemes: {} });
    expect(state.version).toBe(3);
    expect(BUILTIN_THEMES).toHaveLength(8);
    for (const theme of BUILTIN_THEMES) expect(state.profiles.some((item) => item.id === theme.id)).toBe(true);
  });

  it("migrates density, radius and shadows with safe defaults", () => {
    const state = normalizeThemeState({ profiles: [{ id: "legacy", name: "Legacy", background: "#ffffff", text: "#111111" }], layoutThemes: {} });
    const theme = state.profiles.find((item) => item.id === "legacy");
    expect(theme?.density).toBe("comfortable");
    expect(theme?.radius).toBeGreaterThanOrEqual(0);
    expect(theme?.shadowStrength).toBeGreaterThanOrEqual(0);
  });

  it("chooses an accessible text color when auto contrast is enabled", () => {
    const adjusted = ensureContrast({ ...BUILTIN_THEMES[0], background: "#ffffff", text: "#ffffff", muted: "#ffffff" });
    expect(adjusted.text).not.toBe("#ffffff");
    expect(contrastRatio(adjusted.text, adjusted.background)).toBeGreaterThanOrEqual(4.5);
  });

  it("creates visual CSS variables for layout-specific rendering", () => {
    const variables = themeCssVariables(BUILTIN_THEMES[2]);
    expect(variables["--theme-background"]).toBe("#000000");
    expect(variables["--theme-font"]).toContain("Arial");
    expect(variables["--theme-radius"]).toContain("px");
    expect(variables["--theme-density"]).toBeTruthy();
  });

  it("round-trips a theme collection bundle", () => {
    const bundle = createThemeBundle(BUILTIN_THEMES.slice(0, 2));
    const parsed = parseThemeBundle(bundle);
    expect(parsed).toHaveLength(2);
    expect(parsed.every((theme) => theme.mode === "custom")).toBe(true);
  });
});
