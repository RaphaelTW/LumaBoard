#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { cp, readdir, stat } from "node:fs/promises";
import { basename, dirname, join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const packageJson = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
const version = packageJson.version;
const dist = resolve(root, "dist");
const staging = resolve(dist, `LumaBoard-v${version}`);
const zipPath = resolve(dist, `LumaBoard-v${version}.zip`);

const forbiddenNames = new Set([
  ".git",
  ".next",
  "node_modules",
  "tsconfig.tsbuildinfo",
]);

const forbiddenPatterns = [
  /(^|[\\/])\.env(?:\.|$)/,
  /(^|[\\/])\.DS_Store$/,
  /(^|[\\/])Thumbs\.db$/,
  /(^|[\\/])npm-debug\.log$/,
  /(^|[\\/])yarn-error\.log$/,
  /(^|[\\/])pnpm-debug\.log$/,
  /(^|[\\/])coverage([\\/]|$)/,
  /(^|[\\/])dist([\\/]|$)/,
  /(^|[\\/])\.turbo([\\/]|$)/,
  /(^|[\\/])\.cache([\\/]|$)/,
];

function isForbidden(path) {
  const name = basename(path);
  return forbiddenNames.has(name) || forbiddenPatterns.some((pattern) => pattern.test(path));
}

async function copyClean(source, target) {
  const entries = await readdir(source, { withFileTypes: true });
  mkdirSync(target, { recursive: true });
  for (const entry of entries) {
    const sourcePath = join(source, entry.name);
    const relativePath = relative(root, sourcePath);
    if (isForbidden(relativePath)) continue;
    const targetPath = join(target, entry.name);
    if (entry.isDirectory()) await copyClean(sourcePath, targetPath);
    else if (entry.isFile()) await cp(sourcePath, targetPath);
  }
}

async function listFiles(path) {
  const found = [];
  const entries = await readdir(path, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(path, entry.name);
    const relativePath = relative(path, fullPath);
    if (entry.isDirectory()) {
      const nested = await listFiles(fullPath);
      found.push(...nested.map((item) => join(relativePath, item)));
    } else {
      found.push(relativePath);
    }
  }
  return found;
}

async function validatePackage(path) {
  const files = await listFiles(path);
  const forbidden = files.filter(isForbidden);
  if (forbidden.length > 0) {
    throw new Error(`Artefatos proibidos no pacote: ${forbidden.join(", ")}`);
  }
  for (const directory of forbiddenNames) {
    if (existsSync(join(path, directory))) {
      throw new Error(`Artefato proibido no pacote: ${directory}`);
    }
  }
}

function zipStaging() {
  if (existsSync(zipPath)) rmSync(zipPath, { force: true });
  const command = [
    "$ErrorActionPreference = 'Stop';",
    `Compress-Archive -Path ${JSON.stringify(staging)} -DestinationPath ${JSON.stringify(zipPath)} -Force`,
  ].join(" ");
  const result = spawnSync("powershell", ["-NoProfile", "-Command", command], { stdio: "inherit" });
  if (result.status !== 0) throw new Error("Falha ao gerar ZIP da release.");
}

async function sha256(path) {
  const hash = createHash("sha256");
  hash.update(readFileSync(path));
  return hash.digest("hex");
}

rmSync(staging, { recursive: true, force: true });
mkdirSync(dirname(staging), { recursive: true });
await copyClean(root, staging);
await validatePackage(staging);
zipStaging();
const archive = await stat(zipPath);
console.log(`ZIP: ${zipPath}`);
console.log(`SHA-256: ${await sha256(zipPath)}`);
console.log(`Tamanho: ${archive.size} bytes`);
