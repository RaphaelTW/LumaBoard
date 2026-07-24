import { describe, expect, it } from "vitest";
import { BUILTIN_THEMES, contrastRatio, ensureContrast, normalizeThemeState, themeCssVariables } from "./theme-system";

describe("theme system", () => {
  it("restores built-in themes when imported data is incomplete", () => {
    const state = normalizeThemeState({ version: 2, activeThemeId: "custom", profiles: [{ id: "custom", name: "Custom", background: "#ffffff", text: "#111111" }], layoutThemes: {} });
    expect(state.profiles.some((theme) => theme.id === "paper")).toBe(true);
    expect(state.profiles.some((theme) => theme.id === "oled")).toBe(true);
  });

  it("chooses an accessible text color when auto contrast is enabled", () => {
    const adjusted = ensureContrast({ ...BUILTIN_THEMES[0], background: "#ffffff", text: "#ffffff", muted: "#ffffff" });
    expect(adjusted.text).not.toBe("#ffffff");
    expect(contrastRatio(adjusted.text, adjusted.background)).toBeGreaterThanOrEqual(4.5);
  });

  it("creates CSS variables for layout-specific rendering", () => {
    const variables = themeCssVariables(BUILTIN_THEMES[2]);
    expect(variables["--theme-background"]).toBe("#000000");
    expect(variables["--theme-font"]).toContain("Arial");
  });
});
