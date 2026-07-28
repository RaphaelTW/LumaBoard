#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const version = process.argv[2];
if (!version || !/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) {
  console.error("Uso: node scripts/prepare-release.mjs <versão-sem-v>");
  process.exit(1);
}

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), "utf8");
const write = (path, value) => writeFileSync(resolve(root, path), value);

function updateJson(path, updater) {
  const data = JSON.parse(read(path));
  updater(data);
  write(path, `${JSON.stringify(data, null, 2)}\n`);
}

function replaceInFile(path, replacements) {
  let content = read(path);
  for (const [pattern, replacement] of replacements) {
    content = content.replace(pattern, replacement);
  }
  write(path, content);
}

updateJson("package.json", (data) => {
  data.version = version;
});

updateJson("package-lock.json", (data) => {
  data.version = version;
  if (data.packages?.[""]) data.packages[""].version = version;
});

replaceInFile("app/app-version.ts", [
  [/export const APP_VERSION = ".*?";/, `export const APP_VERSION = "${version}";`],
]);

replaceInFile("public/sw.js", [
  [/\/\* LumaBoard v.*? service worker \*\//, `/* LumaBoard v${version} service worker */`],
  [/const VERSION = ".*?";/, `const VERSION = "${version}";`],
]);

replaceInFile("app/deployment.test.ts", [
  [/deployment configuration v\d+\.\d+\.\d+/, `deployment configuration v${version}`],
  [/expect\(packageJson\.version\)\.toBe\(".*?"\);/, `expect(packageJson.version).toBe("${version}");`],
]);

replaceInFile("app/responsive.test.ts", [
  [/responsive experience v\d+\.\d+\.\d+/, `responsive experience v${version}`],
  [/expect\(serviceWorker\)\.toContain\('const VERSION = ".*?";'\);/, `expect(serviceWorker).toContain('const VERSION = "${version}";');`],
]);

replaceInFile("app/privacy-consent.test.ts", [
  [/privacy and legal notice v\d+\.\d+\.\d+/, `privacy and legal notice v${version}`],
]);

replaceInFile("app/security-hardening.test.ts", [
  [/security boundaries v\d+\.\d+\.\d+/, `security boundaries v${version}`],
  [/expect\(packageJson\.version\)\.toBe\(".*?"\);/, `expect(packageJson.version).toBe("${version}");`],
]);

console.log(`Release metadata updated to ${version}.`);
