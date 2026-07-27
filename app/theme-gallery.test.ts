import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const appearance = readFileSync(resolve(process.cwd(), "app/appearance-module.tsx"), "utf8");
const css = readFileSync(resolve(process.cwd(), "app/globals.css"), "utf8");

describe("themes and template gallery UI v1.8.0", () => {
  it("offers editor, bundles and per-layout themes", () => {
    expect(appearance).toContain("Exportar coleção");
    expect(appearance).toContain("TEMAS POR LAYOUT");
    expect(appearance).toContain("shadowStrength");
    expect(appearance).toContain("density");
  });

  it("offers searchable, filterable and favorite templates", () => {
    expect(appearance).toContain("findTemplates");
    expect(appearance).toContain("toggleFavorite");
    expect(appearance).toContain("Visualizar");
    expect(css).toContain(".template-gallery-v2");
    expect(css).toContain(".template-modal-backdrop");
  });
});
