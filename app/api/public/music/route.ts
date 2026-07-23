import { NextRequest, NextResponse } from "next/server";

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

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function numberOrNull(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function safeUrl(value: unknown): string | null {
  const candidate = text(value);
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

async function fetchJson(url: string, timeout = 9000): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "LumaBoard/1.5 (+https://lumaboard.netlify.app)",
      },
      next: { revalidate: 3600 },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
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
  const results = isRecord(payload) && Array.isArray(payload.results) ? payload.results.filter(isRecord) : [];
  return results.flatMap((item) => {
    const id = text(item.trackId) || String(numberOrNull(item.trackId) ?? "");
    const title = text(item.trackName);
    const artist = text(item.artistName);
    const storeUrl = safeUrl(item.trackViewUrl);
    if (!id || !title || !artist || !storeUrl) return [];
    const artwork = safeUrl(item.artworkUrl100)?.replace("100x100", "300x300") ?? null;
    const query = encodeURIComponent(`${title} ${artist}`);
    return [{
      id,
      title,
      artist,
      album: text(item.collectionName),
      genre: text(item.primaryGenreName),
      artworkUrl: artwork,
      previewUrl: safeUrl(item.previewUrl),
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
  const items = Array.isArray(payload) ? payload.filter(isRecord) : [];
  return items.flatMap((item) => {
    const id = text(item.stationuuid);
    const name = text(item.name);
    const candidateStreamUrl = safeUrl(item.url_resolved) ?? safeUrl(item.url);
    const streamUrl = candidateStreamUrl?.startsWith("https:") ? candidateStreamUrl : null;
    if (!id || !name || !streamUrl) return [];
    const tags = text(item.tags).split(",").map((tagValue) => tagValue.trim()).filter(Boolean).slice(0, 6);
    return [{
      id,
      name,
      streamUrl,
      homepage: safeUrl(item.homepage),
      favicon: safeUrl(item.favicon),
      countryCode: text(item.countrycode).toUpperCase(),
      tags,
      codec: text(item.codec),
      bitrate: numberOrNull(item.bitrate),
    }];
  }).slice(0, 12);
}

export async function GET(request: NextRequest) {
  const genreKey = request.nextUrl.searchParams.get("genre")?.toLocaleLowerCase("en-US") ?? "pop";
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
  return response;
}
