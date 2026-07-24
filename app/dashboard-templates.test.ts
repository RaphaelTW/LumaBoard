import { describe, expect, it } from "vitest";
import { DASHBOARD_TEMPLATES } from "./dashboard-templates";
import { decodeDashboardState, encodeDashboardState, normalizeDashboardState } from "./dashboard-config";

describe("dashboard templates", () => {
  it("ships ten unique local templates", () => {
    expect(DASHBOARD_TEMPLATES).toHaveLength(10);
    expect(new Set(DASHBOARD_TEMPLATES.map((template) => template.id)).size).toBe(10);
  });

  it("creates valid layouts without external data", () => {
    for (const template of DASHBOARD_TEMPLATES) {
      const layout = template.createLayout();
      expect(layout.name.length).toBeGreaterThan(0);
      expect(layout.widgets.length).toBeGreaterThan(0);
      expect(layout.columns).toBeGreaterThanOrEqual(1);
    }
  });

  it("round-trips a dashboard through the share encoder", () => {
    const state = normalizeDashboardState({ layouts: [DASHBOARD_TEMPLATES[0].createLayout()] });
    const restored = decodeDashboardState(encodeDashboardState(state));
    expect(restored?.layouts[0].name).toBe("Painel doméstico");
  });
});
