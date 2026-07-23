import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type JsonRecord = Record<string, unknown>;

type NewsItem = {
  id: string;
  title: string;
  url: string;
  score: number;
  source: string;
  publishedAt: string | null;
  imageUrl: string | null;
};

type AnimeItem = {
  id: number;
  title: string;
  url: string;
  score: number | null;
  imageUrl: string | null;
  detail: string;
};

type HolidayItem = {
  date: string;
  name: string;
  type: string;
};

type EarthquakeItem = {
  magnitude: number | null;
  place: string;
  time: string | null;
  url: string;
  distanceKm: number | null;
};

type PublicSummary = {
  updatedAt: string;
  sources: string[];
  news: NewsItem[];
  anime: {
    news: NewsItem[];
    trending: AnimeItem[];
  };
  rates: {
    date: string | null;
    usdBrl: number | null;
    eurBrl: number | null;
  };
  nextHoliday: HolidayItem | null;
  airQuality: {
    europeanAqi: number | null;
    pm25: number | null;
    updatedAt: string | null;
  };
  economy: {
    selicAnnual: number | null;
    selicDate: string | null;
    ipcaMonthly: number | null;
    ipcaDate: string | null;
  };
  ibge: {
    municipalityCode: string | null;
    municipality: string | null;
    state: string | null;
    stateCode: string | null;
    immediateRegion: string | null;
    intermediateRegion: string | null;
    population: number | null;
    populationYear: string | null;
  };
  earthquakes: {
    count24h: number;
    strongest: EarthquakeItem | null;
    nearest: EarthquakeItem | null;
  };
  environment: {
    elevationM: number | null;
    flood: {
      date: string | null;
      discharge: number | null;
      mean: number | null;
      maximum: number | null;
    };
    marine: {
      updatedAt: string | null;
      waveHeightM: number | null;
      seaTemperatureC: number | null;
      currentVelocityKmh: number | null;
    };
    sun: {
      sunrise: string | null;
      sunset: string | null;
      goldenHourEnd: string | null;
      dayLengthSeconds: number | null;
      moonPhase: string | null;
      moonIllumination: number | null;
    };
  };
  content: {
    book: {
      title: string;
      author: string;
      year: number | null;
      url: string;
      coverUrl: string | null;
    } | null;
    wikipedia: {
      title: string;
      description: string;
      excerpt: string;
      url: string;
      thumbnailUrl: string | null;
    } | null;
    tv: {
      show: string;
      episode: string;
      date: string | null;
      time: string | null;
      url: string;
      network: string;
    } | null;
  };
  warnings: string[];
};

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finiteOrNull(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function safeHttpUrl(value: unknown): string | null {
  const candidate = stringOrNull(value);
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

async function fetchJson(url: string, timeout = 7000): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "LumaBoard/1.4 (+https://lumaboard.netlify.app)",
      },
      next: { revalidate: 900 },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}


async function fetchText(url: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/rss+xml, application/xml, text/xml, text/plain",
        "User-Agent": "LumaBoard/1.4 (+https://lumaboard.netlify.app)",
      },
      next: { revalidate: 900 },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

function decodeXml(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (entity, code: string) => {
      const point = Number(code);
      return Number.isInteger(point) && point >= 0 && point <= 0x10ffff
        ? String.fromCodePoint(point)
        : entity;
    })
    .replace(/&#x([0-9a-f]+);/gi, (entity, code: string) => {
      const point = Number.parseInt(code, 16);
      return Number.isInteger(point) && point >= 0 && point <= 0x10ffff
        ? String.fromCodePoint(point)
        : entity;
    })
    .replace(/<[^>]+>/g, "")
    .trim();
}

function xmlTag(block: string, tag: string): string {
  const match = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? decodeXml(match[1]) : "";
}

function xmlAttribute(block: string, tag: string, attribute: string): string {
  const match = block.match(new RegExp(`<${tag}[^>]*\\s${attribute}=["']([^"']+)["'][^>]*>`, "i"));
  return match ? decodeXml(match[1]) : "";
}

function toIsoDate(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function localDateKey(timeZone = "America/Sao_Paulo"): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

async function loadHackerNews(): Promise<NewsItem[]> {
  const idsPayload = await fetchJson(
    "https://hacker-news.firebaseio.com/v0/topstories.json",
  );
  if (!Array.isArray(idsPayload)) throw new Error("Lista de notícias inválida");

  const ids = idsPayload
    .slice(0, 8)
    .map(Number)
    .filter((id) => Number.isInteger(id) && id > 0);
  const stories = await Promise.allSettled(
    ids.map((id) => fetchJson(`https://hacker-news.firebaseio.com/v0/item/${id}.json`)),
  );

  return stories
    .flatMap((result) => (result.status === "fulfilled" ? [result.value] : []))
    .filter(isRecord)
    .map((story): NewsItem | null => {
      const id = Number(story.id);
      const title = typeof story.title === "string" ? story.title.trim() : "";
      if (!Number.isInteger(id) || !title) return null;
      const originalUrl = safeHttpUrl(story.url) ?? "";
      let source = "Hacker News";
      if (originalUrl) {
        try {
          source = new URL(originalUrl).hostname.replace(/^www\./, "");
        } catch {
          // Keep the provider label.
        }
      }
      const timestamp = Number(story.time);
      return {
        id: `hn-${id}`,
        title,
        url: originalUrl || `https://news.ycombinator.com/item?id=${id}`,
        score: Math.max(0, Number(story.score) || 0),
        source,
        publishedAt: Number.isFinite(timestamp) ? new Date(timestamp * 1000).toISOString() : null,
        imageUrl: null,
      };
    })
    .filter((item): item is NewsItem => item !== null)
    .slice(0, 6);
}

async function loadDevNews(): Promise<NewsItem[]> {
  const payload = await fetchJson("https://dev.to/api/articles?top=7&per_page=6");
  if (!Array.isArray(payload)) throw new Error("DEV Community indisponível");
  return payload.filter(isRecord).flatMap((article): NewsItem[] => {
    const id = Number(article.id);
    const title = stringOrNull(article.title);
    const url = safeHttpUrl(article.url);
    if (!Number.isInteger(id) || !title || !url) return [];
    return [{
      id: `dev-${id}`,
      title,
      url,
      score: Math.max(0, Number(article.public_reactions_count) || 0),
      source: "DEV Community",
      publishedAt: toIsoDate(article.published_at),
      imageUrl: safeHttpUrl(article.cover_image) ?? safeHttpUrl(article.social_image),
    }];
  });
}

async function loadNews(): Promise<NewsItem[]> {
  const [hackerNews, devNews] = await Promise.allSettled([loadHackerNews(), loadDevNews()]);
  const combined = [
    ...(hackerNews.status === "fulfilled" ? hackerNews.value : []),
    ...(devNews.status === "fulfilled" ? devNews.value : []),
  ];
  if (combined.length === 0) throw new Error("Notícias de tecnologia indisponíveis");
  return combined
    .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "") || b.score - a.score)
    .slice(0, 10);
}

async function loadAnimeNews(): Promise<NewsItem[]> {
  const xml = await fetchText("https://www.animenewsnetwork.com/all/rss.xml?ann-edition=us");
  const items = xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? [];
  const parsed = items.flatMap((block, index): NewsItem[] => {
    const title = xmlTag(block, "title");
    const url = safeHttpUrl(xmlTag(block, "link"));
    if (!title || !url) return [];
    const guid = xmlTag(block, "guid") || `${index}-${url}`;
    const imageUrl = safeHttpUrl(
      xmlAttribute(block, "media:thumbnail", "url") ||
      xmlAttribute(block, "media:content", "url") ||
      xmlAttribute(block, "enclosure", "url"),
    );
    return [{
      id: `ann-${guid}`,
      title,
      url,
      score: 0,
      source: "Anime News Network",
      publishedAt: toIsoDate(xmlTag(block, "pubDate")),
      imageUrl,
    }];
  });
  if (parsed.length === 0) throw new Error("RSS de anime indisponível");
  return parsed.slice(0, 12);
}

async function loadTrendingAnime(): Promise<AnimeItem[]> {
  const payload = await fetchJson("https://api.jikan.moe/v4/top/anime?filter=airing&limit=8");
  const data = isRecord(payload) && Array.isArray(payload.data) ? payload.data : [];
  const items = data.filter(isRecord).flatMap((anime): AnimeItem[] => {
    const id = Number(anime.mal_id);
    const title = stringOrNull(anime.title_english) ?? stringOrNull(anime.title);
    const url = safeHttpUrl(anime.url);
    if (!Number.isInteger(id) || !title || !url) return [];
    const images = isRecord(anime.images) ? anime.images : {};
    const jpg = isRecord(images.jpg) ? images.jpg : {};
    const episodes = finiteOrNull(anime.episodes);
    const type = stringOrNull(anime.type) ?? "Anime";
    return [{
      id,
      title,
      url,
      score: finiteOrNull(anime.score),
      imageUrl: safeHttpUrl(jpg.large_image_url) ?? safeHttpUrl(jpg.image_url),
      detail: `${type}${episodes === null ? "" : ` · ${Math.round(episodes)} episódios`}`,
    }];
  });
  if (items.length === 0) throw new Error("Jikan sem títulos em exibição");
  return items;
}

async function loadAnime() {
  const [news, trending] = await Promise.allSettled([loadAnimeNews(), loadTrendingAnime()]);
  if (news.status === "rejected" && trending.status === "rejected") {
    throw new Error("Fontes de anime indisponíveis");
  }
  return {
    news: news.status === "fulfilled" ? news.value : [],
    trending: trending.status === "fulfilled" ? trending.value : [],
  };
}

async function loadRates() {
  const [usdPayload, eurPayload] = await Promise.all([
    fetchJson("https://api.frankfurter.dev/v2/rate/USD/BRL"),
    fetchJson("https://api.frankfurter.dev/v2/rate/EUR/BRL"),
  ]);
  const usd = isRecord(usdPayload) ? usdPayload : {};
  const eur = isRecord(eurPayload) ? eurPayload : {};
  return {
    date:
      typeof usd.date === "string"
        ? usd.date
        : typeof eur.date === "string"
          ? eur.date
          : null,
    usdBrl: finiteOrNull(usd.rate),
    eurBrl: finiteOrNull(eur.rate),
  };
}

async function loadHoliday(year: number): Promise<HolidayItem | null> {
  const payloads = await Promise.all([
    fetchJson(`https://brasilapi.com.br/api/feriados/v1/${year}`),
    fetchJson(`https://brasilapi.com.br/api/feriados/v1/${year + 1}`),
  ]);
  const payload = payloads.flatMap((item) => (Array.isArray(item) ? item : []));
  if (payload.length === 0) throw new Error("Feriados inválidos");
  const todayKey = localDateKey();
  const upcoming = payload
    .filter(isRecord)
    .map((item): HolidayItem | null => {
      const date = typeof item.date === "string" ? item.date : "";
      const name = typeof item.name === "string" ? item.name : "";
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !name) return null;
      return {
        date,
        name,
        type: typeof item.type === "string" ? item.type : "national",
      };
    })
    .filter((item): item is HolidayItem => item !== null)
    .sort((a, b) => a.date.localeCompare(b.date))
    .find((item) => item.date >= todayKey);
  return upcoming ?? null;
}

async function loadAirQuality(latitude: number, longitude: number) {
  const url = new URL("https://air-quality-api.open-meteo.com/v1/air-quality");
  url.searchParams.set("latitude", String(latitude));
  url.searchParams.set("longitude", String(longitude));
  url.searchParams.set("current", "european_aqi,pm2_5");
  url.searchParams.set("timezone", "auto");
  const payload = await fetchJson(url.toString());
  const current = isRecord(payload) && isRecord(payload.current) ? payload.current : {};
  return {
    europeanAqi: finiteOrNull(current.european_aqi),
    pm25: finiteOrNull(current.pm2_5),
    updatedAt: typeof current.time === "string" ? current.time : null,
  };
}

function parseBcbItem(value: unknown): { date: string | null; value: number | null } {
  const first = Array.isArray(value) && isRecord(value[0]) ? value[0] : {};
  return {
    date: stringOrNull(first.data),
    value: finiteOrNull(first.valor),
  };
}

async function loadEconomy() {
  const [selicPayload, ipcaPayload] = await Promise.all([
    fetchJson("https://api.bcb.gov.br/dados/serie/bcdata.sgs.1178/dados/ultimos/1?formato=json"),
    fetchJson("https://api.bcb.gov.br/dados/serie/bcdata.sgs.433/dados/ultimos/1?formato=json"),
  ]);
  const selic = parseBcbItem(selicPayload);
  const ipca = parseBcbItem(ipcaPayload);
  return {
    selicAnnual: selic.value,
    selicDate: selic.date,
    ipcaMonthly: ipca.value,
    ipcaDate: ipca.date,
  };
}

function readNestedRecord(record: JsonRecord, key: string): JsonRecord {
  return isRecord(record[key]) ? record[key] : {};
}

function latestSeriesValue(payload: unknown): { value: number | null; year: string | null } {
  if (!Array.isArray(payload)) return { value: null, year: null };
  for (const variable of payload) {
    if (!isRecord(variable) || !Array.isArray(variable.resultados)) continue;
    for (const result of variable.resultados) {
      if (!isRecord(result) || !Array.isArray(result.series)) continue;
      for (const series of result.series) {
        if (!isRecord(series) || !isRecord(series.serie)) continue;
        const entries = Object.entries(series.serie).sort(([a], [b]) => a.localeCompare(b));
        const last = entries.at(-1);
        if (!last) continue;
        return { year: last[0], value: finiteOrNull(last[1]) };
      }
    }
  }
  return { value: null, year: null };
}

async function loadIbge(city: string, stateCode: string) {
  const fallback = {
    municipalityCode: null,
    municipality: city || null,
    state: null,
    stateCode: stateCode || null,
    immediateRegion: null,
    intermediateRegion: null,
    population: null,
    populationYear: null,
  };
  if (!city || !/^[A-Z]{2}$/.test(stateCode)) return fallback;

  const payload = await fetchJson(
    `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${encodeURIComponent(stateCode)}/municipios?orderBy=nome`,
  );
  if (!Array.isArray(payload)) throw new Error("Municípios do IBGE indisponíveis");
  const normalizedCity = normalizeText(city);
  const municipalities = payload.filter(isRecord);
  const municipality =
    municipalities.find((item) => normalizeText(String(item.nome ?? "")) === normalizedCity) ??
    municipalities.find((item) => {
      const name = normalizeText(String(item.nome ?? ""));
      return name && (normalizedCity.includes(name) || name.includes(normalizedCity));
    });
  if (!municipality) return fallback;

  const immediate = readNestedRecord(municipality, "regiao-imediata");
  const intermediate = readNestedRecord(immediate, "regiao-intermediaria");
  const uf = readNestedRecord(intermediate, "UF");
  const municipalityCode = String(municipality.id ?? "");
  let population: number | null = null;
  let populationYear: string | null = null;

  if (/^\d{7}$/.test(municipalityCode)) {
    const populationPayload = await fetchJson(
      `https://servicodados.ibge.gov.br/api/v3/agregados/6579/periodos/-1/variaveis/9324?localidades=N6[${municipalityCode}]`,
    );
    const latest = latestSeriesValue(populationPayload);
    population = latest.value;
    populationYear = latest.year;
  }

  return {
    municipalityCode: municipalityCode || null,
    municipality: stringOrNull(municipality.nome),
    state: stringOrNull(uf.nome),
    stateCode: stringOrNull(uf.sigla) ?? stateCode,
    immediateRegion: stringOrNull(immediate.nome),
    intermediateRegion: stringOrNull(intermediate.nome),
    population,
    populationYear,
  };
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function parseEarthquake(
  feature: JsonRecord,
  latitude: number,
  longitude: number,
): EarthquakeItem | null {
  const properties = isRecord(feature.properties) ? feature.properties : {};
  const geometry = isRecord(feature.geometry) ? feature.geometry : {};
  const coordinates = Array.isArray(geometry.coordinates) ? geometry.coordinates : [];
  const eventLon = Number(coordinates[0]);
  const eventLat = Number(coordinates[1]);
  const timestamp = Number(properties.time);
  const magnitude = finiteOrNull(properties.mag);
  const place = stringOrNull(properties.place) ?? "Local não informado";
  const url = stringOrNull(properties.url) ?? "https://earthquake.usgs.gov/";
  return {
    magnitude,
    place,
    time: Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null,
    url,
    distanceKm:
      Number.isFinite(eventLat) && Number.isFinite(eventLon)
        ? Math.round(haversineKm(latitude, longitude, eventLat, eventLon))
        : null,
  };
}

async function loadEarthquakes(latitude: number, longitude: number) {
  const payload = await fetchJson(
    "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson",
  );
  const record = isRecord(payload) ? payload : {};
  const features = Array.isArray(record.features) ? record.features.filter(isRecord) : [];
  const items = features
    .map((feature) => parseEarthquake(feature, latitude, longitude))
    .filter((item): item is EarthquakeItem => item !== null);
  const strongest = [...items].sort((a, b) => (b.magnitude ?? -1) - (a.magnitude ?? -1))[0] ?? null;
  const nearest = [...items]
    .filter((item) => item.distanceKm !== null)
    .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity))[0] ?? null;
  const metadata = isRecord(record.metadata) ? record.metadata : {};
  return {
    count24h: Math.max(0, Number(metadata.count) || items.length),
    strongest,
    nearest,
  };
}

async function loadElevation(latitude: number, longitude: number) {
  const url = new URL("https://api.open-meteo.com/v1/elevation");
  url.searchParams.set("latitude", String(latitude));
  url.searchParams.set("longitude", String(longitude));
  const payload = await fetchJson(url.toString());
  const values = isRecord(payload) && Array.isArray(payload.elevation) ? payload.elevation : [];
  return finiteOrNull(values[0]);
}

async function loadFlood(latitude: number, longitude: number) {
  const url = new URL("https://flood-api.open-meteo.com/v1/flood");
  url.searchParams.set("latitude", String(latitude));
  url.searchParams.set("longitude", String(longitude));
  url.searchParams.set("daily", "river_discharge,river_discharge_mean,river_discharge_max");
  url.searchParams.set("forecast_days", "3");
  const payload = await fetchJson(url.toString());
  const daily = isRecord(payload) && isRecord(payload.daily) ? payload.daily : {};
  const dates = Array.isArray(daily.time) ? daily.time : [];
  const discharges = Array.isArray(daily.river_discharge) ? daily.river_discharge : [];
  const means = Array.isArray(daily.river_discharge_mean) ? daily.river_discharge_mean : [];
  const maximums = Array.isArray(daily.river_discharge_max) ? daily.river_discharge_max : [];
  return {
    date: stringOrNull(dates[0]),
    discharge: finiteOrNull(discharges[0]),
    mean: finiteOrNull(means[0]),
    maximum: finiteOrNull(maximums[0]),
  };
}

async function loadMarine(latitude: number, longitude: number) {
  const url = new URL("https://marine-api.open-meteo.com/v1/marine");
  url.searchParams.set("latitude", String(latitude));
  url.searchParams.set("longitude", String(longitude));
  url.searchParams.set(
    "current",
    "wave_height,sea_surface_temperature,ocean_current_velocity",
  );
  url.searchParams.set("timezone", "auto");
  const payload = await fetchJson(url.toString());
  const current = isRecord(payload) && isRecord(payload.current) ? payload.current : {};
  return {
    updatedAt: stringOrNull(current.time),
    waveHeightM: finiteOrNull(current.wave_height),
    seaTemperatureC: finiteOrNull(current.sea_surface_temperature),
    currentVelocityKmh: finiteOrNull(current.ocean_current_velocity),
  };
}

async function loadSun(latitude: number, longitude: number, timezone: string) {
  const url = new URL("https://api.sunrise-sunset.org/v2");
  url.searchParams.set("lat", String(latitude));
  url.searchParams.set("lng", String(longitude));
  if (timezone) url.searchParams.set("tz", timezone);
  const payload = await fetchJson(url.toString());
  const record = isRecord(payload) ? payload : {};
  const goldenHour = isRecord(record.golden_hour) ? record.golden_hour : {};
  const eveningGoldenHour = isRecord(goldenHour.evening) ? goldenHour.evening : {};
  return {
    sunrise: stringOrNull(record.sunrise),
    sunset: stringOrNull(record.sunset),
    goldenHourEnd: stringOrNull(eveningGoldenHour.end),
    dayLengthSeconds: finiteOrNull(record.day_length),
    moonPhase: stringOrNull(record.moon_phase),
    moonIllumination: finiteOrNull(record.moon_illumination),
  };
}

async function loadFeaturedBook() {
  const url = new URL("https://openlibrary.org/search.json");
  url.searchParams.set("q", "subject:technology");
  url.searchParams.set("limit", "5");
  url.searchParams.set(
    "fields",
    "key,title,author_name,first_publish_year,cover_i",
  );
  const payload = await fetchJson(url.toString());
  const docs = isRecord(payload) && Array.isArray(payload.docs) ? payload.docs.filter(isRecord) : [];
  if (docs.length === 0) return null;
  const dayIndex = Math.floor(Date.now() / 86_400_000) % docs.length;
  const book = docs[dayIndex];
  const key = stringOrNull(book.key);
  const coverId = finiteOrNull(book.cover_i);
  return {
    title: stringOrNull(book.title) ?? "Livro sem título",
    author:
      Array.isArray(book.author_name) && typeof book.author_name[0] === "string"
        ? book.author_name[0]
        : "Autor não informado",
    year: finiteOrNull(book.first_publish_year),
    url: key ? `https://openlibrary.org${key}` : "https://openlibrary.org/",
    coverUrl: coverId === null ? null : `https://covers.openlibrary.org/b/id/${coverId}-M.jpg`,
  };
}

async function loadWikipedia() {
  const topics = ["ciência", "tecnologia", "Brasil", "natureza", "história", "astronomia"];
  const topic = topics[Math.floor(Date.now() / 86_400_000) % topics.length];
  const url = new URL("https://pt.wikipedia.org/w/rest.php/v1/search/page");
  url.searchParams.set("q", topic);
  url.searchParams.set("limit", "1");
  const payload = await fetchJson(url.toString());
  const pages = isRecord(payload) && Array.isArray(payload.pages) ? payload.pages.filter(isRecord) : [];
  const page = pages[0];
  if (!page) return null;
  const title = stringOrNull(page.title) ?? topic;
  const thumbnail = isRecord(page.thumbnail) ? page.thumbnail : {};
  return {
    title,
    description: stringOrNull(page.description) ?? "Artigo da Wikipédia",
    excerpt: stripHtml(stringOrNull(page.excerpt) ?? ""),
    url: `https://pt.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`,
    thumbnailUrl: stringOrNull(thumbnail.url),
  };
}

function parseTvItem(value: unknown) {
  if (!isRecord(value)) return null;
  const show = isRecord(value.show) ? value.show : {};
  const webChannel = isRecord(show.webChannel) ? show.webChannel : {};
  const network = isRecord(show.network) ? show.network : {};
  const showName = stringOrNull(show.name);
  if (!showName) return null;
  return {
    show: showName,
    episode: stringOrNull(value.name) ?? "Episódio sem título",
    date: stringOrNull(value.airdate),
    time: stringOrNull(value.airtime),
    url: stringOrNull(value.url) ?? stringOrNull(show.url) ?? "https://www.tvmaze.com/",
    network:
      stringOrNull(webChannel.name) ?? stringOrNull(network.name) ?? "Streaming / TV",
  };
}

async function loadTv() {
  const date = localDateKey();
  const webUrl = new URL("https://api.tvmaze.com/schedule/web");
  webUrl.searchParams.set("country", "BR");
  webUrl.searchParams.set("date", date);
  const webPayload = await fetchJson(webUrl.toString());
  const webItems = Array.isArray(webPayload) ? webPayload : [];
  const firstWeb = webItems.map(parseTvItem).find((item) => item !== null);
  if (firstWeb) return firstWeb;

  const regularUrl = new URL("https://api.tvmaze.com/schedule");
  regularUrl.searchParams.set("country", "BR");
  regularUrl.searchParams.set("date", date);
  const regularPayload = await fetchJson(regularUrl.toString());
  const regularItems = Array.isArray(regularPayload) ? regularPayload : [];
  return regularItems.map(parseTvItem).find((item) => item !== null) ?? null;
}

function hasCoordinates(latitude: number, longitude: number): boolean {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

export async function GET(request: NextRequest) {
  const latitude = Number(request.nextUrl.searchParams.get("lat"));
  const longitude = Number(request.nextUrl.searchParams.get("lon"));
  const coordinatesReady = hasCoordinates(latitude, longitude);
  const city = (request.nextUrl.searchParams.get("city") ?? "").trim().slice(0, 100);
  const stateCode = (request.nextUrl.searchParams.get("state") ?? "")
    .trim()
    .toUpperCase()
    .replace(/^BR-/, "")
    .slice(0, 2);
  const timezoneInput = (request.nextUrl.searchParams.get("tz") ?? "").trim().slice(0, 80);
  const timezone = /^[A-Za-z_+-]+(?:\/[A-Za-z0-9_+-]+)+$/.test(timezoneInput)
    ? timezoneInput
    : "America/Sao_Paulo";
  const year = new Date().getFullYear();

  const emptyAir = { europeanAqi: null, pm25: null, updatedAt: null };
  const emptyEarthquakes = { count24h: 0, strongest: null, nearest: null };
  const emptyFlood = { date: null, discharge: null, mean: null, maximum: null };
  const emptyMarine = {
    updatedAt: null,
    waveHeightM: null,
    seaTemperatureC: null,
    currentVelocityKmh: null,
  };
  const emptySun = {
    sunrise: null,
    sunset: null,
    goldenHourEnd: null,
    dayLengthSeconds: null,
    moonPhase: null,
    moonIllumination: null,
  };

  const results = await Promise.allSettled([
    loadNews(),
    loadAnime(),
    loadRates(),
    loadHoliday(year),
    coordinatesReady ? loadAirQuality(latitude, longitude) : Promise.resolve(emptyAir),
    loadEconomy(),
    loadIbge(city, stateCode),
    coordinatesReady
      ? loadEarthquakes(latitude, longitude)
      : Promise.resolve(emptyEarthquakes),
    coordinatesReady ? loadElevation(latitude, longitude) : Promise.resolve(null),
    coordinatesReady ? loadFlood(latitude, longitude) : Promise.resolve(emptyFlood),
    coordinatesReady ? loadMarine(latitude, longitude) : Promise.resolve(emptyMarine),
    coordinatesReady ? loadSun(latitude, longitude, timezone) : Promise.resolve(emptySun),
    loadFeaturedBook(),
    loadWikipedia(),
    loadTv(),
  ]);

  const [
    newsResult,
    animeResult,
    ratesResult,
    holidayResult,
    airResult,
    economyResult,
    ibgeResult,
    earthquakesResult,
    elevationResult,
    floodResult,
    marineResult,
    sunResult,
    bookResult,
    wikipediaResult,
    tvResult,
  ] = results;

  const warningLabels = [
    "notícias de tecnologia",
    "anime",
    "câmbio",
    "feriados",
    "qualidade do ar",
    "economia",
    "IBGE",
    "terremotos",
    "altitude",
    "rios",
    "dados marítimos",
    "dados solares",
    "livros",
    "Wikipédia",
    "programação de TV",
  ];
  const warnings = results.flatMap((result, index) =>
    result.status === "rejected" ? [`${warningLabels[index]} indisponível`] : [],
  );

  const payload: PublicSummary = {
    updatedAt: new Date().toISOString(),
    sources: [
      "Open-Meteo",
      "Sunrise-Sunset.org",
      "Banco Central do Brasil",
      "IBGE",
      "USGS",
      "Frankfurter",
      "BrasilAPI",
      "Hacker News",
      "DEV Community",
      "Anime News Network",
      "Jikan",
      "Open Library",
      "Wikimedia",
      "TVmaze",
    ],
    news: newsResult.status === "fulfilled" ? newsResult.value : [],
    anime: animeResult.status === "fulfilled" ? animeResult.value : { news: [], trending: [] },
    rates:
      ratesResult.status === "fulfilled"
        ? ratesResult.value
        : { date: null, usdBrl: null, eurBrl: null },
    nextHoliday: holidayResult.status === "fulfilled" ? holidayResult.value : null,
    airQuality: airResult.status === "fulfilled" ? airResult.value : emptyAir,
    economy:
      economyResult.status === "fulfilled"
        ? economyResult.value
        : { selicAnnual: null, selicDate: null, ipcaMonthly: null, ipcaDate: null },
    ibge:
      ibgeResult.status === "fulfilled"
        ? ibgeResult.value
        : {
            municipalityCode: null,
            municipality: city || null,
            state: null,
            stateCode: stateCode || null,
            immediateRegion: null,
            intermediateRegion: null,
            population: null,
            populationYear: null,
          },
    earthquakes:
      earthquakesResult.status === "fulfilled" ? earthquakesResult.value : emptyEarthquakes,
    environment: {
      elevationM: elevationResult.status === "fulfilled" ? elevationResult.value : null,
      flood: floodResult.status === "fulfilled" ? floodResult.value : emptyFlood,
      marine: marineResult.status === "fulfilled" ? marineResult.value : emptyMarine,
      sun: sunResult.status === "fulfilled" ? sunResult.value : emptySun,
    },
    content: {
      book: bookResult.status === "fulfilled" ? bookResult.value : null,
      wikipedia: wikipediaResult.status === "fulfilled" ? wikipediaResult.value : null,
      tv: tvResult.status === "fulfilled" ? tvResult.value : null,
    },
    warnings,
  };

  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": "public, max-age=300, s-maxage=900, stale-while-revalidate=86400",
      "X-LumaBoard-Storage": "stateless",
      "X-Robots-Tag": "noindex",
    },
  });
}
