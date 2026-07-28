import { describe, expect, it } from "vitest";
import { DASHBOARD_TEMPLATES, findTemplates, templateCategories } from "./dashboard-templates";
import { decodeDashboardState, encodeDashboardState, normalizeDashboardState } from "./dashboard-config";

describe("dashboard template gallery v1.8.0", () => {
  it("ships sixteen unique local templates", () => {
    expect(DASHBOARD_TEMPLATES).toHaveLength(16);
    expect(new Set(DASHBOARD_TEMPLATES.map((template) => template.id)).size).toBe(16);
    expect(templateCategories()).toHaveLength(5);
  });

  it("creates valid layouts without external data", () => {
    for (const template of DASHBOARD_TEMPLATES) {
      const layout = template.createLayout();
      expect(layout.name.length).toBeGreaterThan(0);
      expect(layout.widgets.length).toBeGreaterThan(0);
      expect(layout.columns).toBeGreaterThanOrEqual(1);
      expect(template.palette).toHaveLength(3);
      expect(template.tags.length).toBeGreaterThan(0);
    }
  });

  it("filters by query and category while sorting favorites first", () => {
    expect(findTemplates("anime", "all").some((template) => template.id === "anime")).toBe(true);
    expect(findTemplates("", "produtividade").every((template) => template.category === "produtividade")).toBe(true);
    expect(findTemplates("", "all", ["study"])[0].id).toBe("study");
  });

  it("normalizes duplicate identifiers and invalid playlist times", () => {
    const layout = DASHBOARD_TEMPLATES[0].createLayout();
    const state = normalizeDashboardState({
      layouts: [{ ...layout, id: "same", widgets: [{ ...layout.widgets[0], id: "same" }, { ...layout.widgets[0], id: "same" }] }, { ...layout, id: "same" }],
      playlist: [{ id: "rule", name: "Teste", layoutId: "same", enabled: true, days: [1], startTime: "29:70", endTime: "-1:00", durationSeconds: 10, order: 0 }],
    });
    expect(new Set(state.layouts.map((item) => item.id)).size).toBe(state.layouts.length);
    expect(new Set(state.layouts[0].widgets.map((item) => item.id)).size).toBe(state.layouts[0].widgets.length);
    expect(state.playlist[0].startTime).toBe("00:00");
    expect(state.playlist[0].endTime).toBe("23:59");
  });

  it("round-trips a dashboard through the share encoder", () => {
    const state = normalizeDashboardState({ layouts: [DASHBOARD_TEMPLATES[0].createLayout()] });
    const restored = decodeDashboardState(encodeDashboardState(state));
    expect(restored?.layouts[0].name).toBe("Painel doméstico");
  });
});
