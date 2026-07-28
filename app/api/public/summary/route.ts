import { NextRequest, NextResponse } from "next/server";
import { loadAnime } from "./anime";
import { loadEconomy, loadHoliday, loadRates } from "./economy";
import { loadAirQuality, loadElevation, loadFlood, loadMarine, loadSun } from "./environment";
import { loadEarthquakes, hasCoordinates, loadIbge } from "./geo";
import { loadNews } from "./news";
import { loadArtwork, loadFeaturedBook, loadTv, loadWikipedia } from "./sources/content";
import type { PublicSummary } from "./summary-types";
import { consumeRateLimit, normalizeCoordinate, normalizePublicQuery, normalizeTimezone, rateLimitHeaders, rateLimitResponse, rejectCrossSiteRequest } from "../security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const emptyAir = { europeanAqi: null, pm25: null, updatedAt: null };
const emptyEarthquakes = { count24h: 0, strongest: null, nearest: null };
const emptyFlood = { date: null, discharge: null, mean: null, maximum: null };
const emptyMarine = { updatedAt: null, waveHeightM: null, seaTemperatureC: null, currentVelocityKmh: null };
const emptySun = {
  sunrise: null,
  sunset: null,
  goldenHourEnd: null,
  dayLengthSeconds: null,
  moonPhase: null,
  moonIllumination: null,
};

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
  "arte",
  "livros",
  "Wikipédia",
  "programação de TV",
];

export async function GET(request: NextRequest) {
  const crossSite = rejectCrossSiteRequest(request);
  if (crossSite) return crossSite;
  const rateLimit = consumeRateLimit(request, { scope: "public-summary", limit: 12, windowMs: 60_000 });
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit);

  const latitudeRaw = request.nextUrl.searchParams.get("lat");
  const longitudeRaw = request.nextUrl.searchParams.get("lon");
  const latitude = normalizeCoordinate(latitudeRaw, -90, 90);
  const longitude = normalizeCoordinate(longitudeRaw, -180, 180);
  const hasAnyCoordinate = latitudeRaw !== null || longitudeRaw !== null;
  if (hasAnyCoordinate && (latitude === null || longitude === null)) {
    return NextResponse.json({ error: "Coordenadas inválidas" }, { status: 400, headers: { ...rateLimitHeaders(rateLimit), "Cache-Control": "private, no-store" } });
  }
  const coordinatesReady = latitude !== null && longitude !== null && hasCoordinates(latitude, longitude);
  const city = normalizePublicQuery(request.nextUrl.searchParams.get("city") ?? "", 80);
  const stateCode = normalizePublicQuery(request.nextUrl.searchParams.get("state") ?? "", 8).toUpperCase().replace(/^BR-/, "").replace(/[^A-Z]/g, "").slice(0, 2);
  const timezone = normalizeTimezone(request.nextUrl.searchParams.get("tz") ?? "");
  const year = new Date().getFullYear();

  const results = await Promise.allSettled([
    loadNews(),
    loadAnime(),
    loadRates(),
    loadHoliday(year),
    coordinatesReady ? loadAirQuality(latitude!, longitude!) : Promise.resolve(emptyAir),
    loadEconomy(),
    loadIbge(city, stateCode),
    coordinatesReady ? loadEarthquakes(latitude!, longitude!) : Promise.resolve(emptyEarthquakes),
    coordinatesReady ? loadElevation(latitude!, longitude!) : Promise.resolve(null),
    coordinatesReady ? loadFlood(latitude!, longitude!) : Promise.resolve(emptyFlood),
    coordinatesReady ? loadMarine(latitude!, longitude!) : Promise.resolve(emptyMarine),
    coordinatesReady ? loadSun(latitude!, longitude!, timezone) : Promise.resolve(emptySun),
    loadArtwork(),
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
    artworkResult,
    bookResult,
    wikipediaResult,
    tvResult,
  ] = results;

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
      "Art Institute of Chicago",
    ],
    news: newsResult.status === "fulfilled" ? newsResult.value : [],
    anime: animeResult.status === "fulfilled" ? animeResult.value : { news: [], trending: [] },
    rates: ratesResult.status === "fulfilled" ? ratesResult.value : { date: null, usdBrl: null, eurBrl: null },
    nextHoliday: holidayResult.status === "fulfilled" ? holidayResult.value : null,
    airQuality: airResult.status === "fulfilled" ? airResult.value : emptyAir,
    economy: economyResult.status === "fulfilled" ? economyResult.value : { selicAnnual: null, selicDate: null, ipcaMonthly: null, ipcaDate: null },
    ibge: ibgeResult.status === "fulfilled" ? ibgeResult.value : {
      municipalityCode: null,
      municipality: city || null,
      state: null,
      stateCode: stateCode || null,
      immediateRegion: null,
      intermediateRegion: null,
      population: null,
      populationYear: null,
    },
    earthquakes: earthquakesResult.status === "fulfilled" ? earthquakesResult.value : emptyEarthquakes,
    environment: {
      elevationM: elevationResult.status === "fulfilled" ? elevationResult.value : null,
      flood: floodResult.status === "fulfilled" ? floodResult.value : emptyFlood,
      marine: marineResult.status === "fulfilled" ? marineResult.value : emptyMarine,
      sun: sunResult.status === "fulfilled" ? sunResult.value : emptySun,
    },
    content: {
      artwork: artworkResult.status === "fulfilled" ? artworkResult.value : null,
      book: bookResult.status === "fulfilled" ? bookResult.value : null,
      wikipedia: wikipediaResult.status === "fulfilled" ? wikipediaResult.value : null,
      tv: tvResult.status === "fulfilled" ? tvResult.value : null,
    },
    warnings,
  };

  const locationScoped = hasAnyCoordinate || Boolean(city) || Boolean(stateCode);
  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": locationScoped ? "private, no-store" : "public, max-age=300, s-maxage=900, stale-while-revalidate=86400",
      "X-LumaBoard-Storage": "stateless",
      "X-Robots-Tag": "noindex",
      ...rateLimitHeaders(rateLimit),
    },
  });
}
