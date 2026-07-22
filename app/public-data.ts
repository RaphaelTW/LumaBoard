"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isRecord, readStoredValue, writeStoredValue } from "./storage";

const PUBLIC_DATA_KEY = "lumaboard-public-data-v2";
const DEFAULT_REFRESH_MINUTES = 15;
const REFRESH_SETTINGS_KEY = "lumaboard-refresh-minutes";

export type PublicNewsItem = {
  id: number;
  title: string;
  url: string;
  score: number;
  source: string;
};

export type PublicEarthquake = {
  magnitude: number | null;
  place: string;
  time: string | null;
  url: string;
  distanceKm: number | null;
};

export type PublicSummary = {
  updatedAt: string;
  sources: string[];
  news: PublicNewsItem[];
  rates: {
    date: string | null;
    usdBrl: number | null;
    eurBrl: number | null;
  };
  nextHoliday: {
    date: string;
    name: string;
    type: string;
  } | null;
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
    strongest: PublicEarthquake | null;
    nearest: PublicEarthquake | null;
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

type PublicDataStatus = "loading" | "ready" | "stale" | "error";

export const DEFAULT_PUBLIC_PLUGIN_IDS = [
  "air",
  "rates",
  "holidays",
  "news",
  "economy",
  "ibge",
  "earthquakes",
  "elevation",
  "flood",
  "marine",
  "sun",
  "books",
  "wikipedia",
  "tv",
] as const;

const LEGACY_PUBLIC_PLUGIN_IDS = new Set(["air", "rates", "holidays", "news"]);
const PUBLIC_PLUGIN_ID_SET = new Set<string>(DEFAULT_PUBLIC_PLUGIN_IDS);

export function normalizeEnabledPublicPlugins(value: unknown): string[] {
  if (!Array.isArray(value)) return [...DEFAULT_PUBLIC_PLUGIN_IDS];

  const filtered = Array.from(new Set(value.filter(
    (item): item is string => typeof item === "string" && PUBLIC_PLUGIN_ID_SET.has(item),
  )));

  const isVersionOneDefault =
    filtered.length === LEGACY_PUBLIC_PLUGIN_IDS.size &&
    filtered.every((item) => LEGACY_PUBLIC_PLUGIN_IDS.has(item));

  return isVersionOneDefault ? [...DEFAULT_PUBLIC_PLUGIN_IDS] : filtered;
}

export const initialPublicSummary: PublicSummary = {
  updatedAt: "",
  sources: [
    "Open-Meteo",
    "Sunrise-Sunset.org",
    "Banco Central do Brasil",
    "IBGE",
    "USGS",
    "Frankfurter",
    "BrasilAPI",
    "Hacker News",
    "Open Library",
    "Wikimedia",
    "TVmaze",
  ],
  news: [],
  rates: { date: null, usdBrl: null, eurBrl: null },
  nextHoliday: null,
  airQuality: { europeanAqi: null, pm25: null, updatedAt: null },
  economy: { selicAnnual: null, selicDate: null, ipcaMonthly: null, ipcaDate: null },
  ibge: {
    municipalityCode: null,
    municipality: null,
    state: null,
    stateCode: null,
    immediateRegion: null,
    intermediateRegion: null,
    population: null,
    populationYear: null,
  },
  earthquakes: { count24h: 0, strongest: null, nearest: null },
  environment: {
    elevationM: null,
    flood: { date: null, discharge: null, mean: null, maximum: null },
    marine: {
      updatedAt: null,
      waveHeightM: null,
      seaTemperatureC: null,
      currentVelocityKmh: null,
    },
    sun: {
      sunrise: null,
      sunset: null,
      goldenHourEnd: null,
      dayLengthSeconds: null,
      moonPhase: null,
      moonIllumination: null,
    },
  },
  content: { book: null, wikipedia: null, tv: null },
  warnings: [],
};

function nullableNumber(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isFinite(value));
}

function isPublicSummary(value: unknown): value is PublicSummary {
  if (!isRecord(value)) return false;
  if (typeof value.updatedAt !== "string") return false;
  if (!Array.isArray(value.sources) || !Array.isArray(value.news) || !Array.isArray(value.warnings)) {
    return false;
  }
  if (
    !isRecord(value.rates) ||
    !isRecord(value.airQuality) ||
    !isRecord(value.economy) ||
    !isRecord(value.ibge) ||
    !isRecord(value.earthquakes) ||
    !isRecord(value.environment) ||
    !isRecord(value.content)
  ) {
    return false;
  }
  const environment = value.environment;
  if (!isRecord(environment.flood) || !isRecord(environment.marine) || !isRecord(environment.sun)) {
    return false;
  }
  return (
    nullableNumber(value.rates.usdBrl) &&
    nullableNumber(value.rates.eurBrl) &&
    nullableNumber(value.airQuality.europeanAqi) &&
    nullableNumber(value.airQuality.pm25) &&
    nullableNumber(value.economy.selicAnnual) &&
    nullableNumber(value.economy.ipcaMonthly) &&
    nullableNumber(environment.elevationM)
  );
}

async function fetchSummary(
  latitude: number,
  longitude: number,
  city: string,
  stateCode: string,
  timezone: string,
) {
  const url = new URL("/api/public/summary", window.location.origin);
  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    url.searchParams.set("lat", latitude.toFixed(4));
    url.searchParams.set("lon", longitude.toFixed(4));
  }
  if (city.trim()) url.searchParams.set("city", city.trim());
  if (stateCode.trim()) url.searchParams.set("state", stateCode.trim().toUpperCase());
  if (timezone.trim()) url.searchParams.set("tz", timezone.trim());
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 25000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload: unknown = await response.json();
    if (!isPublicSummary(payload)) throw new Error("Resumo público inválido");
    return payload;
  } finally {
    window.clearTimeout(timer);
  }
}

export function describeAqi(aqi: number | null): string {
  if (aqi === null) return "Sem leitura";
  if (aqi <= 20) return "Muito boa";
  if (aqi <= 40) return "Boa";
  if (aqi <= 60) return "Moderada";
  if (aqi <= 80) return "Ruim";
  if (aqi <= 100) return "Muito ruim";
  return "Extremamente ruim";
}

function clampRefreshMinutes(value: unknown): number {
  const number = Number(value);
  if (!Number.isFinite(number)) return DEFAULT_REFRESH_MINUTES;
  return Math.min(60, Math.max(5, Math.round(number / 5) * 5));
}

export function usePublicSummary(
  latitude: number,
  longitude: number,
  city: string,
  stateCode: string,
  timezone: string,
) {
  const [summary, setSummary] = useState<PublicSummary>(initialPublicSummary);
  const [status, setStatus] = useState<PublicDataStatus>("loading");
  const [refreshMinutes, setRefreshMinutes] = useState(DEFAULT_REFRESH_MINUTES);
  const running = useRef(false);

  const refresh = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    setStatus((current) => (current === "ready" ? current : "loading"));
    try {
      const payload = await fetchSummary(latitude, longitude, city, stateCode, timezone);
      setSummary(payload);
      setStatus("ready");
      writeStoredValue(PUBLIC_DATA_KEY, payload);
    } catch {
      const cached = readStoredValue<PublicSummary | null>(
        PUBLIC_DATA_KEY,
        (value): value is PublicSummary | null => value === null || isPublicSummary(value),
        null,
      );
      if (cached) {
        setSummary(cached);
        setStatus("stale");
      } else {
        setStatus("error");
      }
    } finally {
      running.current = false;
    }
  }, [city, latitude, longitude, stateCode, timezone]);

  useEffect(() => {
    const readRefreshMinutes = () => {
      try {
        return clampRefreshMinutes(JSON.parse(window.localStorage.getItem(REFRESH_SETTINGS_KEY) ?? "null"));
      } catch {
        return DEFAULT_REFRESH_MINUTES;
      }
    };
    const syncRefreshMinutes = (event?: Event) => {
      if (event instanceof CustomEvent) {
        setRefreshMinutes(clampRefreshMinutes(event.detail));
        return;
      }
      setRefreshMinutes(readRefreshMinutes());
    };
    queueMicrotask(() => syncRefreshMinutes());
    window.addEventListener("lumaboard:refresh-interval", syncRefreshMinutes);
    window.addEventListener("storage", syncRefreshMinutes);
    return () => {
      window.removeEventListener("lumaboard:refresh-interval", syncRefreshMinutes);
      window.removeEventListener("storage", syncRefreshMinutes);
    };
  }, []);

  useEffect(() => {
    const cached = readStoredValue<PublicSummary | null>(
      PUBLIC_DATA_KEY,
      (value): value is PublicSummary | null => value === null || isPublicSummary(value),
      null,
    );
    if (cached) {
      queueMicrotask(() => {
        setSummary(cached);
        setStatus("stale");
      });
    }
    queueMicrotask(() => void refresh());
    const timer = window.setInterval(() => void refresh(), refreshMinutes * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [refresh, refreshMinutes]);

  return { summary, status, refresh, refreshMinutes };
}
