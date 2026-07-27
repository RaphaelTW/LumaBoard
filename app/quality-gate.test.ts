import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appearance = readFileSync(new URL("./appearance-module.tsx", import.meta.url), "utf8");
const modules = readFileSync(new URL("./modules.tsx", import.meta.url), "utf8");
const display = readFileSync(new URL("./display/display-client.tsx", import.meta.url), "utf8");
const experience = readFileSync(new URL("./experience-module.tsx", import.meta.url), "utf8");
const verifier = readFileSync(new URL("../scripts/verify-release.ps1", import.meta.url), "utf8");

describe("quality gate v1.8.1", () => {
  it("does not mirror derived theme or device state through synchronous effects", () => {
    expect(appearance).not.toContain("useEffect(() => setSelectedId");
    expect(modules).not.toContain("setRefreshMinutes(selected.interval)");
  });

  it("uses Next Link for the internal display exit", () => {
    expect(display).toContain('import Link from "next/link"');
    expect(display).toContain('<Link href="/" aria-label="Sair do display">');
  });

  it("uses icon exports available in the installed lucide-react version", () => {
    expect(experience).not.toContain(" Install,");
    expect(experience).not.toContain("<Install />");
    expect(experience).toContain("<Download /> Instalar app");
  });

  it("stops Windows release verification when external commands fail", () => {
    expect(verifier).toContain("if ($LASTEXITCODE -ne 0)");
    expect(verifier).toContain("Validação concluída com sucesso.");
    expect(verifier).toContain("Não foi possível remover node_modules");
  });
});
