import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { APP_USER_AGENT } from "../../app-version";
import { hasSafeJsonStructure } from "../../import-security";

const MAX_RATE_BUCKETS = 2_000;
const DEFAULT_MAX_RESPONSE_BYTES = 4_000_000;
const UNSAFE_TEXT = /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g;
const DANGEROUS_HOST_SUFFIXES = [".local", ".localhost", ".internal", ".lan", ".home", ".test", ".example", ".invalid"];

type RateBucket = { count: number; resetAt: number };
type RateLimitPolicy = { scope: string; limit: number; windowMs: number };
export type RateLimitState = { allowed: boolean; limit: number; remaining: number; resetAt: number };

type FetchOptions = {
  timeoutMs?: number;
  revalidateSeconds?: number;
  noStore?: boolean;
  maxBytes?: number;
  accept?: string;
  allowedHosts: readonly string[];
};

const rateBuckets = new Map<string, RateBucket>();

function normalizeIp(value: string | null): string {
  const candidate = (value ?? "").split(",")[0]?.trim().slice(0, 80) ?? "";
  return /^[0-9a-f:.]+$/i.test(candidate) ? candidate.toLowerCase() : "anonymous";
}

function clientKey(request: NextRequest): string {
  const ip = normalizeIp(request.headers.get("x-nf-client-connection-ip") ?? request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for"));
  return createHash("sha256").update(ip).digest("hex").slice(0, 24);
}

function cleanupRateBuckets(now: number) {
  for (const [key, bucket] of rateBuckets) if (bucket.resetAt <= now) rateBuckets.delete(key);
  while (rateBuckets.size > MAX_RATE_BUCKETS) {
    const oldest = rateBuckets.keys().next().value as string | undefined;
    if (!oldest) break;
    rateBuckets.delete(oldest);
  }
}

export function consumeRateLimit(request: NextRequest, policy: RateLimitPolicy): RateLimitState {
  const now = Date.now();
  cleanupRateBuckets(now);
  const key = `${policy.scope}:${clientKey(request)}`;
  const current = rateBuckets.get(key);
  const bucket = !current || current.resetAt <= now ? { count: 0, resetAt: now + policy.windowMs } : current;
  bucket.count += 1;
  rateBuckets.delete(key);
  rateBuckets.set(key, bucket);
  return { allowed: bucket.count <= policy.limit, limit: policy.limit, remaining: Math.max(0, policy.limit - bucket.count), resetAt: bucket.resetAt };
}

export function rateLimitHeaders(state: RateLimitState): Record<string, string> {
  return {
    "RateLimit-Limit": String(state.limit),
    "RateLimit-Remaining": String(state.remaining),
    "RateLimit-Reset": String(Math.max(1, Math.ceil((state.resetAt - Date.now()) / 1000))),
  };
}

export function rateLimitResponse(state: RateLimitState): NextResponse {
  const resetSeconds = Math.max(1, Math.ceil((state.resetAt - Date.now()) / 1000));
  return NextResponse.json({ error: "Muitas solicitações. Aguarde um pouco e tente novamente." }, {
    status: 429,
    headers: { ...rateLimitHeaders(state), "Retry-After": String(resetSeconds), "Cache-Control": "private, no-store" },
  });
}


export function rejectCrossSiteRequest(request: NextRequest): NextResponse | null {
  const fetchSite = request.headers.get("sec-fetch-site")?.toLowerCase() ?? "";
  if (fetchSite === "cross-site") {
    return NextResponse.json({ error: "Solicitação entre sites não autorizada." }, {
      status: 403,
      headers: { "Cache-Control": "private, no-store", "Vary": "Sec-Fetch-Site, Origin" },
    });
  }
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      if (new URL(origin).origin !== request.nextUrl.origin) {
        return NextResponse.json({ error: "Origem não autorizada." }, {
          status: 403,
          headers: { "Cache-Control": "private, no-store", "Vary": "Sec-Fetch-Site, Origin" },
        });
      }
    } catch {
      return NextResponse.json({ error: "Origem inválida." }, {
        status: 403,
        headers: { "Cache-Control": "private, no-store", "Vary": "Sec-Fetch-Site, Origin" },
      });
    }
  }
  return null;
}

export function sanitizePublicText(value: unknown, maximumLength = 4_000): string {
  if (typeof value !== "string") return "";
  return value.normalize("NFKC").replace(UNSAFE_TEXT, " ").replace(/\s+/g, " ").trim().slice(0, maximumLength);
}

export function normalizePublicQuery(value: string, maximumLength = 100): string {
  return sanitizePublicText(value, maximumLength);
}

export function normalizeCoordinate(value: string | null, minimum: number, maximum: number): number | null {
  if (value === null || value.trim() === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < minimum || number > maximum) return null;
  return Math.round(number * 100) / 100;
}

export function normalizeTimezone(value: string): string {
  const normalized = normalizePublicQuery(value, 64);
  return /^[A-Za-z_+-]+(?:\/[A-Za-z0-9_+-]+)+$/.test(normalized) ? normalized : "America/Sao_Paulo";
}

function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname.split(".");
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part) || Number(part) > 255)) return false;
  const [a, b] = parts.map(Number);
  return a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 0 || b === 168 || b === 88)) ||
    (a === 198 && (b === 18 || b === 19 || b === 51)) || (a === 203 && b === 0);
}

function isPrivateIpv6(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!host.includes(":")) return false;
  return host === "::" || host === "::1" || /^(?:fc|fd|ff)/.test(host) || /^fe[89ab]/.test(host) || host.startsWith("::ffff:") || host.startsWith("100:") || host.startsWith("2001:db8:") || host.startsWith("2001:2:");
}

function isPublicHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  if (!host || host === "localhost" || DANGEROUS_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))) return false;
  if (!host.includes(".") && !host.includes(":")) return false;
  return !isPrivateIpv4(host) && !isPrivateIpv6(host);
}

function hostMatches(hostname: string, allowedHost: string): boolean {
  const host = hostname.toLowerCase();
  const allowed = allowedHost.toLowerCase();
  return allowed.startsWith("*.") ? host.endsWith(allowed.slice(1)) && host !== allowed.slice(2) : host === allowed;
}

export function safePublicHttpsUrl(value: unknown, options: { allowedHosts?: readonly string[]; allowNonStandardPort?: boolean } = {}): string | null {
  if (typeof value !== "string") return null;
  const candidate = value.trim().startsWith("//") ? `https:${value.trim()}` : value.trim();
  if (!candidate || candidate.length > 2_048) return null;
  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:" || url.username || url.password || !isPublicHostname(url.hostname)) return null;
    if (!options.allowNonStandardPort && url.port && url.port !== "443") return null;
    if (options.allowedHosts && !options.allowedHosts.some((host) => hostMatches(url.hostname, host))) return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function assertAllowedUpstreamUrl(value: string, allowedHosts: readonly string[]): URL {
  const safe = safePublicHttpsUrl(value, { allowedHosts });
  if (!safe) throw new Error("Upstream não autorizado");
  return new URL(safe);
}

async function readLimitedText(response: Response, maxBytes: number): Promise<string> {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) throw new Error("Resposta externa excedeu o limite");
  if (!response.body) {
    const text = await response.text();
    if (new TextEncoder().encode(text).byteLength > maxBytes) throw new Error("Resposta externa excedeu o limite");
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
      throw new Error("Resposta externa excedeu o limite");
    }
    chunks.push(value);
  }
  const combined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { combined.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(combined);
}

async function fetchLimited(url: string, options: FetchOptions): Promise<{ text: string; contentType: string }> {
  const target = assertAllowedUpstreamUrl(url, options.allowedHosts);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 9_000);
  try {
    const cacheOptions = options.noStore ? { cache: "no-store" as const } : { next: { revalidate: options.revalidateSeconds ?? 900 } };
    const response = await fetch(target, {
      signal: controller.signal,
      redirect: "error",
      headers: { Accept: options.accept ?? "application/json", "User-Agent": APP_USER_AGENT },
      ...cacheOptions,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return { text: await readLimitedText(response, options.maxBytes ?? DEFAULT_MAX_RESPONSE_BYTES), contentType: response.headers.get("content-type")?.toLowerCase() ?? "" };
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchJsonLimited(url: string, options: FetchOptions): Promise<unknown> {
  const result = await fetchLimited(url, options);
  if (result.contentType && !result.contentType.includes("json") && !result.contentType.includes("javascript")) throw new Error("Resposta externa não é JSON");
  const parsed: unknown = JSON.parse(result.text);
  if (!hasSafeJsonStructure(parsed, {
    maxBytes: options.maxBytes ?? DEFAULT_MAX_RESPONSE_BYTES,
    maxDepth: 32,
    maxNodes: 30_000,
    maxArrayItems: 5_000,
    maxObjectKeys: 1_000,
    maxStringLength: 1_000_000,
  })) throw new Error("Resposta JSON externa excedeu os limites estruturais");
  return parsed;
}

export async function fetchTextLimited(url: string, options: FetchOptions): Promise<string> {
  return (await fetchLimited(url, options)).text;
}
