import { hasSafeJsonStructure } from "./import-security";

const DEFAULT_MAX_BYTES = 5_000_000;
const DEFAULT_TIMEOUT_MS = 15_000;

type JsonFetchPolicy = {
  timeoutMs?: number;
  maxBytes?: number;
  maxNodes?: number;
  allowedHosts?: readonly string[];
  localPublicApi?: boolean;
};

function byteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function hostAllowed(hostname: string, allowedHosts: readonly string[]): boolean {
  const host = hostname.toLowerCase();
  return allowedHosts.some((candidate) => host === candidate.toLowerCase());
}

async function readLimitedText(response: Response, maxBytes: number): Promise<string> {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) throw new Error("Resposta acima do limite permitido.");
  if (!response.body) {
    const text = await response.text();
    if (byteLength(text) > maxBytes) throw new Error("Resposta acima do limite permitido.");
    return text;
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel("response-too-large");
      throw new Error("Resposta acima do limite permitido.");
    }
    chunks.push(value);
  }
  const combined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(combined);
}

export async function fetchJsonWithPolicy(
  input: string | URL,
  policy: JsonFetchPolicy,
): Promise<{ response: Response; payload: unknown }> {
  if (typeof window === "undefined") throw new Error("Camada de rede disponível somente no navegador.");
  const url = new URL(input.toString(), window.location.origin);
  if (policy.localPublicApi) {
    if (url.origin !== window.location.origin || !url.pathname.startsWith("/api/public/")) throw new Error("Endpoint local não autorizado.");
  } else {
    if (url.protocol !== "https:" || url.username || url.password || url.port) throw new Error("Endpoint externo inválido.");
    if (!policy.allowedHosts || !hostAllowed(url.hostname, policy.allowedHosts)) throw new Error("Host externo não autorizado.");
  }

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), policy.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "error",
      credentials: policy.localPublicApi ? "same-origin" : "omit",
      referrerPolicy: "no-referrer",
      headers: { Accept: "application/json" },
    });
    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    if (!contentType.includes("application/json")) throw new Error("Resposta não é JSON.");
    const text = await readLimitedText(response, policy.maxBytes ?? DEFAULT_MAX_BYTES);
    const payload: unknown = JSON.parse(text);
    if (!hasSafeJsonStructure(payload, {
      maxBytes: policy.maxBytes ?? DEFAULT_MAX_BYTES,
      maxNodes: policy.maxNodes ?? 50_000,
      maxArrayItems: 5_000,
      maxObjectKeys: 1_000,
      maxStringLength: 1_000_000,
    })) throw new Error("Resposta JSON inválida ou excessivamente complexa.");
    return { response, payload };
  } finally {
    window.clearTimeout(timer);
  }
}
