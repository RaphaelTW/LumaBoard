#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { cp, readdir, stat } from "node:fs/promises";
import { basename, dirname, join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const packageJson = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
const version = packageJson.version;
const dist = resolve(root, "dist");
const staging = resolve(dist, `LumaBoard-v${version}`);
const zipPath = resolve(dist, `LumaBoard-v${version}.zip`);
const checksumPath = resolve(dist, `LumaBoard-v${version}.sha256`);

const forbiddenNames = new Set([".git", ".next", ".idea", ".vscode", "node_modules", "tsconfig.tsbuildinfo", "coverage", "dist"]);
const forbiddenPatterns = [
  /(^|[\\/])\.env(?:\.|$)/i,
  /(^|[\\/])\.DS_Store$/i,
  /(^|[\\/])Thumbs\.db$/i,
  /(^|[\\/])(?:npm|yarn|pnpm)-debug\.log$/i,
  /(^|[\\/])(?:\.turbo|\.cache|\.parcel-cache)([\\/]|$)/i,
  /(^|[\\/]).*\.(?:log|tmp|temp|pem|key|p12|pfx|jks|keystore|sqlite|sqlite3|db)$/i,
  /(^|[\\/])(?:credentials?|service-account)(?:\.|$)/i,
];

function normalized(path) { return path.replaceAll("\\", "/"); }
function isForbidden(path) {
  const rel = normalized(path);
  return forbiddenNames.has(basename(rel)) || forbiddenPatterns.some((pattern) => pattern.test(rel));
}

function runSecurityScan() {
  const result = spawnSync(process.execPath, [resolve(root, "scripts/security-scan.mjs")], { cwd: root, stdio: "inherit" });
  if (result.status !== 0) throw new Error("A varredura de segurança falhou; o pacote não foi criado.");
}

async function copyClean(source, target) {
  const entries = await readdir(source, { withFileTypes: true });
  mkdirSync(target, { recursive: true });
  for (const entry of entries) {
    const sourcePath = join(source, entry.name);
    const relativePath = relative(root, sourcePath);
    if (isForbidden(relativePath)) continue;
    if (lstatSync(sourcePath).isSymbolicLink()) throw new Error(`Link simbólico não permitido no pacote: ${relativePath}`);
    const targetPath = join(target, entry.name);
    if (entry.isDirectory()) await copyClean(sourcePath, targetPath);
    else if (entry.isFile()) await cp(sourcePath, targetPath);
  }
}

async function listFiles(path, base = path) {
  const found = [];
  const entries = await readdir(path, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(path, entry.name);
    if (lstatSync(fullPath).isSymbolicLink()) throw new Error(`Link simbólico encontrado no staging: ${relative(base, fullPath)}`);
    if (entry.isDirectory()) found.push(...await listFiles(fullPath, base));
    else if (entry.isFile()) found.push(relative(base, fullPath));
  }
  return found;
}

async function validatePackage(path) {
  const files = await listFiles(path);
  const forbidden = files.filter(isForbidden);
  if (forbidden.length > 0) throw new Error(`Artefatos proibidos no pacote: ${forbidden.join(", ")}`);
  for (const directory of forbiddenNames) if (existsSync(join(path, directory))) throw new Error(`Artefato proibido no pacote: ${directory}`);
  for (const required of ["package.json", "package-lock.json", "SECURITY.md", "public/sw.js", "scripts/security-scan.mjs"]) {
    if (!existsSync(join(path, required))) throw new Error(`Arquivo obrigatório ausente no pacote: ${required}`);
  }
}

function zipStaging() {
  if (existsSync(zipPath)) rmSync(zipPath, { force: true });
  if (process.platform === "win32") {
    const command = ["$ErrorActionPreference = 'Stop';", `Compress-Archive -Path ${JSON.stringify(staging)} -DestinationPath ${JSON.stringify(zipPath)} -Force`].join(" ");
    const result = spawnSync("powershell", ["-NoProfile", "-Command", command], { stdio: "inherit" });
    if (result.status !== 0) throw new Error("Falha ao gerar ZIP da release.");
    return;
  }
  const python = [
    "import pathlib, zipfile, sys",
    "source=pathlib.Path(sys.argv[1]); target=pathlib.Path(sys.argv[2])",
    "with zipfile.ZipFile(target, 'w', zipfile.ZIP_DEFLATED) as z:",
    "    for p in source.rglob('*'):",
    "        if p.is_file(): z.write(p, p.relative_to(source.parent))",
  ].join("\n");
  const result = spawnSync("python3", ["-c", python, staging, zipPath], { stdio: "inherit" });
  if (result.status !== 0) throw new Error("Falha ao gerar ZIP da release.");
}

function sha256(path) {
  const hash = createHash("sha256");
  hash.update(readFileSync(path));
  return hash.digest("hex");
}

runSecurityScan();
rmSync(staging, { recursive: true, force: true });
mkdirSync(dirname(staging), { recursive: true });
await copyClean(root, staging);
await validatePackage(staging);
zipStaging();
const archive = await stat(zipPath);
const checksum = sha256(zipPath);
writeFileSync(checksumPath, `${checksum}  ${basename(zipPath)}\n`);
console.log(`ZIP: ${zipPath}`);
console.log(`SHA-256: ${checksum}`);
console.log(`Checksum: ${checksumPath}`);
console.log(`Tamanho: ${archive.size} bytes`);
