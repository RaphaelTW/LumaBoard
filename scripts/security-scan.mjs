#!/usr/bin/env node
import { readFileSync, readdirSync, lstatSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";

const root = process.cwd();
const ignored = new Set([".git", ".next", "node_modules", "dist", "coverage", ".cache", ".turbo"]);
const textExtensions = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs", ".json", ".md", ".toml", ".css", ".html", ".xml", ".yml", ".yaml", ".ps1"]);
const failures = [];
const warnings = [];

function fail(message) { failures.push(message); }
function normalize(path) { return path.replaceAll("\\", "/"); }

function walk(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const absolute = join(directory, entry.name);
    const rel = normalize(relative(root, absolute));
    const stat = lstatSync(absolute);
    if (stat.isSymbolicLink()) {
      fail(`Link simbólico não permitido: ${rel}`);
      continue;
    }
    if (entry.isDirectory()) files.push(...walk(absolute));
    else if (entry.isFile()) files.push({ absolute, rel });
  }
  return files;
}

const files = walk(root);
const sensitiveName = /(^|\/)(?:\.env(?:\..*)?|id_rsa|id_ed25519|.*\.(?:pem|key|p12|pfx|jks|keystore|sqlite|sqlite3|db)|credentials?(?:\..*)?|service-account(?:\..*)?)$/i;
for (const file of files) if (sensitiveName.test(file.rel)) fail(`Arquivo sensível encontrado: ${file.rel}`);

const textFiles = files.filter((file) => textExtensions.has(extname(file.rel).toLowerCase()) || ["LICENSE", ".npmrc", ".editorconfig", ".gitignore"].includes(file.rel));
const secretPatterns = [
  ["chave privada", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ["token GitHub", /\bgh[pousr]_[A-Za-z0-9_]{30,}\b/],
  ["chave AWS", /\bAKIA[0-9A-Z]{16}\b/],
  ["token Google", /\bAIza[0-9A-Za-z_-]{30,}\b/],
  ["segredo genérico", /(?:api[_-]?key|client[_-]?secret|access[_-]?token)\s*[:=]\s*["'][^"']{16,}["']/i],
];
for (const file of textFiles) {
  const content = readFileSync(file.absolute, "utf8");
  for (const [label, pattern] of secretPatterns) if (pattern.test(content)) fail(`${label} potencial em ${file.rel}`);
  if (/\b(?:eval|Function)\s*\(/.test(content) && !file.rel.endsWith("security-scan.mjs")) fail(`Execução dinâmica detectada em ${file.rel}`);
  if (!file.rel.endsWith("security-scan.mjs") && /dangerouslySetInnerHTML|\.innerHTML\s*=|document\.write\s*\(/.test(content)) fail(`HTML dinâmico perigoso detectado em ${file.rel}`);
  if (file.rel.endsWith(".tsx") && /target=["']_blank["']/.test(content)) {
    const tags = content.match(/<a\b[^>]*target=["']_blank["'][^>]*>/g) ?? [];
    for (const tag of tags) if (!/rel=["'][^"']*noopener[^"']*noreferrer[^"']*["']/.test(tag)) fail(`Link _blank sem noopener+noreferrer em ${file.rel}`);
  }
  if (file.rel.endsWith(".svg") && /<script\b|\son\w+\s*=|javascript:/i.test(content)) fail(`SVG ativo detectado em ${file.rel}`);
}

const rawFetchAllowed = new Set(["app/client-fetch.ts", "app/api/public/security.ts"]);
for (const file of textFiles.filter((item) => item.rel.startsWith("app/") && /\.(?:ts|tsx)$/.test(item.rel))) {
  const content = readFileSync(file.absolute, "utf8");
  if (/\bfetch\s*\(/.test(content) && !rawFetchAllowed.has(file.rel) && !file.rel.endsWith(".test.ts") && !file.rel.endsWith(".test.tsx")) fail(`fetch direto fora da camada controlada: ${file.rel}`);
}

const packageJson = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
const lock = JSON.parse(readFileSync(resolve(root, "package-lock.json"), "utf8"));
const allDependencies = { ...(packageJson.dependencies ?? {}), ...(packageJson.devDependencies ?? {}) };
for (const [name, version] of Object.entries(allDependencies)) {
  if (typeof version !== "string" || /^[~^*]|(?:latest|next)$/i.test(version) || /[<>| ]/.test(version)) fail(`Dependência de topo não fixada exatamente: ${name}@${version}`);
  const locked = lock.packages?.[`node_modules/${name}`]?.version;
  if (locked !== version) fail(`Lockfile divergente: ${name} package=${version} lock=${locked ?? "ausente"}`);
  if (!lock.packages?.[`node_modules/${name}`]?.integrity) fail(`Integridade ausente no lockfile: ${name}`);
}
if (lock.packages?.[""]?.version !== packageJson.version) fail("Versão da raiz diverge entre package.json e package-lock.json");
for (const [path, metadata] of Object.entries(lock.packages ?? {})) {
  if (!path.startsWith("node_modules/") || metadata?.link === true) continue;
  if (typeof metadata?.integrity !== "string" || !metadata.integrity.startsWith("sha512-")) fail(`Integridade SHA-512 ausente no lockfile: ${path}`);
  if (typeof metadata?.resolved !== "string" || !metadata.resolved.startsWith("https://registry.npmjs.org/")) fail(`Origem de pacote não autorizada no lockfile: ${path}`);
}
for (const [name, version] of Object.entries(packageJson.overrides ?? {})) {
  if (typeof version === "string" && (/^[~^*]/.test(version) || /[<>| ]/.test(version))) fail(`Override não fixado exatamente: ${name}@${version}`);
}
const allowedInstallScripts = Object.entries(packageJson.allowScripts ?? {}).filter(([, allowed]) => allowed === true).map(([name]) => name).sort();
const expectedInstallScripts = ["esbuild", "sharp", "unrs-resolver"];
if (JSON.stringify(allowedInstallScripts) !== JSON.stringify(expectedInstallScripts)) fail(`allowScripts deve conter somente: ${expectedInstallScripts.join(", ")}`);

const nextConfig = readFileSync(resolve(root, "next.config.ts"), "utf8");
const netlify = readFileSync(resolve(root, "netlify.toml"), "utf8");
for (const marker of ["object-src 'none'", "frame-ancestors 'none'", "script-src-attr 'none'", "Strict-Transport-Security", "Cross-Origin-Resource-Policy"]) {
  if (!nextConfig.includes(marker)) fail(`Header/CSP ausente no Next: ${marker}`);
  if (!netlify.includes(marker)) fail(`Header/CSP ausente no Netlify: ${marker}`);
}
const productionPolicy = netlify.match(/Content-Security-Policy\s*=\s*"([^"]+)"/)?.[1] ?? "";
if (productionPolicy.includes("unsafe-eval")) fail("CSP de produção contém unsafe-eval");
if (/connect-src[^;]*https:\s*(?:;|$)/.test(productionPolicy)) fail("connect-src de produção está amplo demais");

const sw = readFileSync(resolve(root, "public/sw.js"), "utf8");
for (const marker of ["CACHE_LIMITS", "CACHE_MAX_BYTES", "cacheControlDisallowsStorage", "ALLOWED_MESSAGE_TYPES", "redirect: \"error\"", "request.headers.has(\"range\")"]) if (!sw.includes(marker)) fail(`Proteção ausente no service worker: ${marker}`);

const requiredScripts = ["security:scan", "security:audit", "security:signatures", "security:full"];
for (const script of requiredScripts) if (!packageJson.scripts?.[script]) fail(`Script obrigatório ausente: ${script}`);

for (const warning of warnings) console.warn(`AVISO: ${warning}`);
if (failures.length) {
  console.error("\nFalhas da varredura de segurança:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`Varredura de segurança concluída: ${files.length} arquivos inspecionados.`);
