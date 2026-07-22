import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type JsonRecord = Record<string, unknown>;

type NewsItem = {
  id: number;
  title: string;
  url: string;
  score: number;
  source: string;
};

type HolidayItem = {
  date: string;
  name: string;
  type: string;
};

type PublicSummary = {
  updatedAt: string;
  sources: string[];
  news: NewsItem[];
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
  warnings: string[];
};

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finiteOrNull(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

async function fetchJson(url: string, timeout = 8000): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "LumaBoard/1.2 (+https://lumaboard.netlify.app)",
      },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

async function loadNews(): Promise<NewsItem[]> {
  const idsPayload = await fetchJson(
    "https://hacker-news.firebaseio.com/v0/topstories.json",
  );
  if (!Array.isArray(idsPayload)) throw new Error("Lista de notícias inválida");

  const ids = idsPayload
    .slice(0, 8)
    .map(Number)
    .filter((id) => Number.isInteger(id) && id > 0);
  const stories = await Promise.allSettled(
    ids.map((id) =>
      fetchJson(`https://hacker-news.firebaseio.com/v0/item/${id}.json`),
    ),
  );

  return stories
    .flatMap((result) => (result.status === "fulfilled" ? [result.value] : []))
    .filter(isRecord)
    .map((story): NewsItem | null => {
      const id = Number(story.id);
      const title = typeof story.title === "string" ? story.title.trim() : "";
      if (!Number.isInteger(id) || !title) return null;
      const originalUrl = typeof story.url === "string" ? story.url : "";
      let source = "news.ycombinator.com";
      if (originalUrl) {
        try {
          source = new URL(originalUrl).hostname.replace(/^www\./, "");
        } catch {
          // Keep the Hacker News source label.
        }
      }
      return {
        id,
        title,
        url: originalUrl || `https://news.ycombinator.com/item?id=${id}`,
        score: Math.max(0, Number(story.score) || 0),
        source,
      };
    })
    .filter((item): item is NewsItem => item !== null)
    .slice(0, 5);
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
  const today = new Date();
  const todayKey = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  );
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
    .find((item) => new Date(`${item.date}T12:00:00Z`) >= todayKey);
  return upcoming ?? null;
}

async function loadAirQuality(latitude: number, longitude: number) {
  const url = new URL(
    "https://air-quality-api.open-meteo.com/v1/air-quality",
  );
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

export async function GET(request: NextRequest) {
  const latitude = Number(request.nextUrl.searchParams.get("lat"));
  const longitude = Number(request.nextUrl.searchParams.get("lon"));
  const hasCoordinates =
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180;
  const year = new Date().getFullYear();

  const [newsResult, ratesResult, holidayResult, airResult] =
    await Promise.allSettled([
      loadNews(),
      loadRates(),
      loadHoliday(year),
      hasCoordinates
        ? loadAirQuality(latitude, longitude)
        : Promise.resolve({ europeanAqi: null, pm25: null, updatedAt: null }),
    ]);

  const warnings: string[] = [];
  if (newsResult.status === "rejected") warnings.push("notícias indisponíveis");
  if (ratesResult.status === "rejected") warnings.push("câmbio indisponível");
  if (holidayResult.status === "rejected") warnings.push("feriados indisponíveis");
  if (airResult.status === "rejected") warnings.push("qualidade do ar indisponível");

  const payload: PublicSummary = {
    updatedAt: new Date().toISOString(),
    sources: ["Open-Meteo", "Frankfurter", "BrasilAPI", "Hacker News"],
    news: newsResult.status === "fulfilled" ? newsResult.value : [],
    rates:
      ratesResult.status === "fulfilled"
        ? ratesResult.value
        : { date: null, usdBrl: null, eurBrl: null },
    nextHoliday:
      holidayResult.status === "fulfilled" ? holidayResult.value : null,
    airQuality:
      airResult.status === "fulfilled"
        ? airResult.value
        : { europeanAqi: null, pm25: null, updatedAt: null },
    warnings,
  };

  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": "public, max-age=300, s-maxage=900, stale-while-revalidate=86400",
      "X-LumaBoard-Storage": "stateless",
    },
  });
}
