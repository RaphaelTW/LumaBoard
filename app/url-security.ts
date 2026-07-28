const PRIVATE_SUFFIXES = [".local", ".localhost", ".internal", ".lan", ".home", ".test", ".example", ".invalid"];
const IMAGE_HOSTS = [
  "covers.openlibrary.org",
  "upload.wikimedia.org",
  "static.tvmaze.com",
  "images.openfoodfacts.org",
  "www.artic.edu",
  "cdn.myanimelist.net",
  "media.dev.to",
  "cdn.animenewsnetwork.com",
  "www.animenewsnetwork.com",
] as const;

function privateIpv4(host: string): boolean {
  const parts = host.split(".");
  if (parts.length !== 4 || parts.some((item) => !/^\d{1,3}$/.test(item) || Number(item) > 255)) return false;
  const [a, b] = parts.map(Number);
  return a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 0 || b === 168)) ||
    (a === 192 && b === 88) ||
    (a === 198 && (b === 18 || b === 19 || b === 51)) ||
    (a === 203 && b === 0);
}

function publicHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (!host || host === "localhost" || PRIVATE_SUFFIXES.some((suffix) => host.endsWith(suffix))) return false;
  if (!host.includes(".") && !host.includes(":")) return false;
  if (privateIpv4(host)) return false;
  if (host === "::" || host === "::1" || /^(?:fc|fd|ff)/.test(host) || /^fe[89ab]/.test(host)) return false;
  if (host.startsWith("::ffff:") || host.startsWith("100:") || host.startsWith("2001:db8:") || host.startsWith("2001:2:")) return false;
  return true;
}

function hostAllowed(hostname: string, allowed: readonly string[]): boolean {
  const host = hostname.toLowerCase();
  return allowed.some((entry) => {
    const candidate = entry.toLowerCase();
    if (candidate.startsWith("*.")) return host.endsWith(candidate.slice(1)) && host !== candidate.slice(2);
    return host === candidate;
  });
}

export function safeExternalUrl(value: unknown, allowNonStandardPort = false): string {
  if (typeof value !== "string") return "";
  const raw = value.trim().startsWith("//") ? `https:${value.trim()}` : value.trim();
  if (!raw || raw.length > 2_048) return "";
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.username || url.password || !publicHost(url.hostname)) return "";
    if (!allowNonStandardPort && url.port && url.port !== "443") return "";
    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}

export function safeExternalImageUrl(value: unknown): string {
  const safe = safeExternalUrl(value);
  if (!safe) return "";
  const hostname = new URL(safe).hostname;
  return hostAllowed(hostname, [...IMAGE_HOSTS, "*.dev.to", "*.mzstatic.com"]) ? safe : "";
}

export function safeExternalMediaUrl(value: unknown): string {
  return safeExternalUrl(value, true);
}

export function safeDownloadFilename(value: string, fallback: string): string {
  const sanitize = (candidate: string) => candidate
    .normalize("NFKC")
    .replace(/[<>:"/\\|?*\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/^[. ]+|[. ]+$/g, "")
    .slice(0, 100);
  const normalized = sanitize(value) || sanitize(fallback) || "lumaboard-export";
  return /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(normalized) ? `_${normalized}` : normalized;
}
