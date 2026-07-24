import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
  version: string;
  devDependencies?: Record<string, string>;
};
const nextConfig = readFileSync(new URL("../next.config.ts", import.meta.url), "utf8");
const netlify = readFileSync(new URL("../netlify.toml", import.meta.url), "utf8");
const globalCss = readFileSync(new URL("./globals.css", import.meta.url), "utf8");

describe("deployment configuration v1.6.3", () => {
  it("pins Turbopack and output tracing to the actual project root", () => {
    expect(nextConfig).toContain("fileURLToPath(import.meta.url)");
    expect(nextConfig).toContain("outputFileTracingRoot: projectRoot");
    expect(nextConfig).toContain("root: projectRoot");
  });

  it("uses Netlify OpenNext auto-detection instead of publishing .next directly", () => {
    expect(netlify).toContain('command = "npm run build"');
    expect(netlify).not.toContain('publish = ".next"');
    expect(netlify).toContain('NETLIFY_NEXT_SKEW_PROTECTION = "true"');
  });

  it("does not require Tailwind for the custom CSS design system", () => {
    expect(packageJson.version).toBe("1.6.3");
    expect(packageJson.devDependencies?.tailwindcss).toBeUndefined();
    expect(packageJson.devDependencies?.["@tailwindcss/postcss"]).toBeUndefined();
    expect(globalCss).not.toContain('@import "tailwindcss"');
  });
});
