import { NextRequest, NextResponse } from "next/server";
import { consumeRateLimit, fetchJsonLimited, rateLimitHeaders, rateLimitResponse, rejectCrossSiteRequest, safePublicHttpsUrl, sanitizePublicText } from "../security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RecordValue = Record<string, unknown>;

const GENRES: Record<string, { term: string; radioTag: string }> = {
  pop: { term: "pop hits", radioTag: "pop" },
  rock: { term: "rock hits", radioTag: "rock" },
  indie: { term: "indie music", radioTag: "indie" },
  electronic: { term: "electronic dance", radioTag: "electronic" },
  jazz: { term: "jazz", radioTag: "jazz" },
  classical: { term: "classical music", radioTag: "classical" },
  lofi: { term: "lofi chill", radioTag: "lofi" },
  anime: { term: "anime soundtrack", radioTag: "anime" },
  brazilian: { term: "música brasileira mpb", radioTag: "brazilian" },
  gospel: { term: "gospel", radioTag: "gospel" },
  hiphop: { term: "hip hop", radioTag: "hip hop" },
  metal: { term: "heavy metal", radioTag: "metal" },
};

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown, maximumLength = 500): string {
  return sanitizePublicText(value, maximumLength);
}

function numberOrNull(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

const MUSIC_UPSTREAM_HOSTS = [
  "itunes.apple.com",
  "de1.api.radio-browser.info",
  "at1.api.radio-browser.info",
] as const;

async function fetchJson(url: string, timeout = 9_000): Promise<unknown> {
  return fetchJsonLimited(url, { allowedHosts: MUSIC_UPSTREAM_HOSTS, timeoutMs: timeout, revalidateSeconds: 3_600, maxBytes: 3_000_000 });
}

async function loadTracks(term: string) {
  const url = new URL("https://itunes.apple.com/search");
  url.searchParams.set("term", term);
  url.searchParams.set("media", "music");
  url.searchParams.set("entity", "song");
  url.searchParams.set("country", "BR");
  url.searchParams.set("limit", "24");
  url.searchParams.set("explicit", "No");
  const payload = await fetchJson(url.toString());
  const results = isRecord(payload) && Array.isArray(payload.results) ? payload.results.filter(isRecord).slice(0, 48) : [];
  return results.flatMap((item) => {
    const id = text(item.trackId) || String(numberOrNull(item.trackId) ?? "");
    const title = text(item.trackName);
    const artist = text(item.artistName);
    const storeUrl = safePublicHttpsUrl(item.trackViewUrl, { allowedHosts: ["music.apple.com", "itunes.apple.com"] });
    if (!id || !title || !artist || !storeUrl) return [];
    const artwork = safePublicHttpsUrl(item.artworkUrl100, { allowedHosts: ["*.mzstatic.com"] })?.replace("100x100", "300x300") ?? null;
    const query = encodeURIComponent(`${title} ${artist}`);
    return [{
      id,
      title,
      artist,
      album: text(item.collectionName),
      genre: text(item.primaryGenreName),
      artworkUrl: artwork,
      previewUrl: safePublicHttpsUrl(item.previewUrl, { allowedHosts: ["*.itunes.apple.com", "*.mzstatic.com"] }),
      storeUrl,
      spotifySearchUrl: `https://open.spotify.com/search/${query}`,
    }];
  }).slice(0, 18);
}

async function loadStations(tag: string) {
  const servers = ["https://de1.api.radio-browser.info", "https://at1.api.radio-browser.info"];
  let payload: unknown = [];
  let lastError: unknown;
  for (const server of servers) {
    try {
      const url = new URL("/json/stations/search", server);
      url.searchParams.set("tag", tag);
      url.searchParams.set("hidebroken", "true");
      url.searchParams.set("order", "clickcount");
      url.searchParams.set("reverse", "true");
      url.searchParams.set("limit", "20");
      payload = await fetchJson(url.toString());
      break;
    } catch (error) {
      lastError = error;
    }
  }
  if (!Array.isArray(payload) && lastError) throw lastError;
  const items = Array.isArray(payload) ? payload.filter(isRecord).slice(0, 40) : [];
  return items.flatMap((item) => {
    const id = text(item.stationuuid);
    const name = text(item.name);
    const streamUrl = safePublicHttpsUrl(item.url_resolved, { allowNonStandardPort: true }) ?? safePublicHttpsUrl(item.url, { allowNonStandardPort: true });
    if (!id || !name || !streamUrl) return [];
    const tags = text(item.tags).split(",").map((tagValue) => tagValue.trim()).filter(Boolean).slice(0, 6);
    return [{
      id,
      name,
      streamUrl,
      homepage: safePublicHttpsUrl(item.homepage),
      favicon: null,
      countryCode: text(item.countrycode).toUpperCase(),
      tags,
      codec: text(item.codec),
      bitrate: numberOrNull(item.bitrate),
    }];
  }).slice(0, 12);
}

export async function GET(request: NextRequest) {
  const crossSite = rejectCrossSiteRequest(request);
  if (crossSite) return crossSite;
  const rateLimit = consumeRateLimit(request, { scope: "public-music", limit: 20, windowMs: 60_000 });
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit);
  const genreKey = request.nextUrl.searchParams.get("genre")?.toLocaleLowerCase("en-US").slice(0, 24) ?? "pop";
  const genre = GENRES[genreKey] ?? GENRES.pop;
  const [tracksResult, stationsResult] = await Promise.allSettled([
    loadTracks(genre.term),
    loadStations(genre.radioTag),
  ]);
  const tracks = tracksResult.status === "fulfilled" ? tracksResult.value : [];
  const stations = stationsResult.status === "fulfilled" ? stationsResult.value : [];
  const warnings = [
    tracksResult.status === "rejected" ? "Apple iTunes Search indisponível" : "",
    stationsResult.status === "rejected" ? "Radio Browser indisponível" : "",
  ].filter(Boolean);
  const response = NextResponse.json({
    genre: genreKey in GENRES ? genreKey : "pop",
    updatedAt: new Date().toISOString(),
    tracks,
    stations,
    warnings,
    sources: ["Apple iTunes Search API", "Radio Browser"],
  });
  response.headers.set("Cache-Control", "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400");
  response.headers.set("X-LumaBoard-Storage", "stateless");
  response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  for (const [key, value] of Object.entries(rateLimitHeaders(rateLimit))) response.headers.set(key, value);
  return response;
}
