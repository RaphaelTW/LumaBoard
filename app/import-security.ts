import { safeDownloadFilename } from "./url-security";

export const MAX_IMPORT_FILE_BYTES = 4_500_000;
export const MAX_IMPORT_DEPTH = 32;
export const MAX_IMPORT_NODES = 50_000;
export const MAX_IMPORT_ARRAY_ITEMS = 5_000;
export const MAX_IMPORT_OBJECT_KEYS = 1_000;
export const MAX_IMPORT_STRING_LENGTH = 1_000_000;

const DANGEROUS_KEYS = new Set(["__proto__", "prototype", "constructor"]);

type JsonLimits = {
  maxBytes?: number;
  maxDepth?: number;
  maxNodes?: number;
  maxArrayItems?: number;
  maxObjectKeys?: number;
  maxStringLength?: number;
};

type WalkEntry = { value: unknown; depth: number };

function byteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

export function hasSafeJsonStructure(value: unknown, limits: JsonLimits = {}): boolean {
  const maxDepth = limits.maxDepth ?? MAX_IMPORT_DEPTH;
  const maxNodes = limits.maxNodes ?? MAX_IMPORT_NODES;
  const maxArrayItems = limits.maxArrayItems ?? MAX_IMPORT_ARRAY_ITEMS;
  const maxObjectKeys = limits.maxObjectKeys ?? MAX_IMPORT_OBJECT_KEYS;
  const maxStringLength = limits.maxStringLength ?? MAX_IMPORT_STRING_LENGTH;
  const stack: WalkEntry[] = [{ value, depth: 0 }];
  let nodes = 0;

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) break;
    nodes += 1;
    if (nodes > maxNodes || current.depth > maxDepth) return false;

    const item = current.value;
    if (item === null || typeof item === "boolean") continue;
    if (typeof item === "number") {
      if (!Number.isFinite(item)) return false;
      continue;
    }
    if (typeof item === "string") {
      if (item.length > maxStringLength) return false;
      continue;
    }
    if (typeof item !== "object") return false;

    if (Array.isArray(item)) {
      if (item.length > maxArrayItems) return false;
      for (const child of item) stack.push({ value: child, depth: current.depth + 1 });
      continue;
    }

    const prototype = Object.getPrototypeOf(item);
    if (prototype !== Object.prototype && prototype !== null) return false;
    const entries = Object.entries(item as Record<string, unknown>);
    if (entries.length > maxObjectKeys) return false;
    for (const [key, child] of entries) {
      if (DANGEROUS_KEYS.has(key) || key.length > 200) return false;
      stack.push({ value: child, depth: current.depth + 1 });
    }
  }

  return true;
}

export function parseSafeJsonText(text: string, limits: JsonLimits = {}): unknown {
  const maxBytes = limits.maxBytes ?? MAX_IMPORT_FILE_BYTES;
  if (!text || byteLength(text) > maxBytes) throw new Error("Arquivo JSON excede o limite permitido.");
  const value: unknown = JSON.parse(text);
  if (!hasSafeJsonStructure(value, limits)) throw new Error("Estrutura JSON inválida ou excessivamente complexa.");
  return value;
}

export async function readTextFileLimited(file: File, maxBytes: number): Promise<string> {
  if (!file || file.size <= 0 || file.size > maxBytes) throw new Error("Arquivo vazio ou acima do limite permitido.");
  const text = await file.text();
  if (byteLength(text) > maxBytes) throw new Error("Arquivo acima do limite permitido.");
  return text;
}

export async function readSafeJsonFile(file: File, limits: JsonLimits = {}): Promise<unknown> {
  const maxBytes = limits.maxBytes ?? MAX_IMPORT_FILE_BYTES;
  if (!file || file.size <= 0 || file.size > maxBytes) throw new Error("Arquivo vazio ou acima do limite permitido.");
  return parseSafeJsonText(await file.text(), { ...limits, maxBytes });
}

export function downloadTextFile(filename: string, content: string, mime = "application/json") {
  const safeName = safeDownloadFilename(filename, "lumaboard-export.json");
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = safeName;
  anchor.rel = "noopener";
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
