"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const LOCATION_KEY = "lumaboard-location-v1";
const WEATHER_KEY = "lumaboard-weather-v1";
const LOCATION_TTL = 60 * 60 * 1000;
const REFRESH_INTERVAL = 15 * 60 * 1000;

type LocationSource = "gps" | "ip" | "saved" | "fallback";

type StoredLocation = {
  latitude: number;
  longitude: number;
  city: string;
  source: LocationSource;
  savedAt: number;
};

export type WeatherSnapshot = {
  city: string;
  temperature: number | null;
  apparentTemperature: number | null;
  minimum: number | null;
  maximum: number | null;
  weatherCode: number;
  isDay: boolean;
  description: string;
  timezone: string;
  updatedAt: string | null;
  locationSource: LocationSource;
};

type WeatherStatus = "loading" | "ready" | "stale" | "error";

const fallbackLocation: StoredLocation = {
  latitude: -23.5505,
  longitude: -46.6333,
  city: "São Paulo",
  source: "fallback",
  savedAt: 0,
};

export const initialWeather: WeatherSnapshot = {
  city: "Localizando…",
  temperature: null,
  apparentTemperature: null,
  minimum: null,
  maximum: null,
  weatherCode: 2,
  isDay: true,
  description: "Buscando previsão",
  timezone: "America/Sao_Paulo",
  updatedAt: null,
  locationSource: "fallback",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readJSON<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function readStoredLocation(): StoredLocation | null {
  const value = readJSON<StoredLocation>(LOCATION_KEY);
  if (
    !value ||
    !Number.isFinite(value.latitude) ||
    !Number.isFinite(value.longitude) ||
    typeof value.city !== "string"
  ) {
    return null;
  }
  return value;
}

function readStoredWeather(): WeatherSnapshot | null {
  const value = readJSON<WeatherSnapshot>(WEATHER_KEY);
  if (!value || typeof value.city !== "string") return null;
  return value;
}

async function fetchJSON(url: URL, timeout = 9000): Promise<unknown> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    window.clearTimeout(timer);
  }
}

function browserCoordinates(): Promise<GeolocationCoordinates> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocalização indisponível"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve(position.coords),
      reject,
      { enableHighAccuracy: false, maximumAge: 10 * 60 * 1000, timeout: 8000 },
    );
  });
}

function locationName(payload: Record<string, unknown>): string {
  const candidates = [
    payload.locality,
    payload.city,
    payload.principalSubdivision,
    payload.countryName,
  ];
  return (
    candidates.find((value): value is string =>
      typeof value === "string" && value.trim().length > 0,
    ) ?? "Sua localização"
  );
}

async function reverseLocation(
  latitude?: number,
  longitude?: number,
): Promise<StoredLocation> {
  const url = new URL(
    "https://api.bigdatacloud.net/data/reverse-geocode-client",
  );
  url.searchParams.set("localityLanguage", "pt");
  if (latitude !== undefined && longitude !== undefined) {
    url.searchParams.set("latitude", String(latitude));
    url.searchParams.set("longitude", String(longitude));
  }

  const payload = await fetchJSON(url);
  if (!isRecord(payload)) throw new Error("Localização inválida");

  const resolvedLatitude = Number(payload.latitude ?? latitude);
  const resolvedLongitude = Number(payload.longitude ?? longitude);
  if (!Number.isFinite(resolvedLatitude) || !Number.isFinite(resolvedLongitude)) {
    throw new Error("Coordenadas inválidas");
  }

  return {
    latitude: resolvedLatitude,
    longitude: resolvedLongitude,
    city: locationName(payload),
    source: latitude === undefined ? "ip" : "gps",
    savedAt: Date.now(),
  };
}

async function resolveLocation(force: boolean): Promise<StoredLocation> {
  const stored = readStoredLocation();
  if (!force && stored && Date.now() - stored.savedAt < LOCATION_TTL) {
    return { ...stored, source: "saved" };
  }

  try {
    const coordinates = await browserCoordinates();
    return await reverseLocation(coordinates.latitude, coordinates.longitude);
  } catch {
    try {
      return await reverseLocation();
    } catch {
      return stored ?? fallbackLocation;
    }
  }
}

export function describeWeatherCode(code: number): string {
  if (code === 0) return "Céu limpo";
  if (code === 1) return "Predominantemente limpo";
  if (code === 2) return "Parcialmente nublado";
  if (code === 3) return "Nublado";
  if (code === 45 || code === 48) return "Neblina";
  if (code >= 51 && code <= 57) return "Garoa";
  if (code >= 61 && code <= 67) return "Chuva";
  if (code >= 71 && code <= 77) return "Neve";
  if (code >= 80 && code <= 82) return "Pancadas de chuva";
  if (code >= 85 && code <= 86) return "Pancadas de neve";
  if (code >= 95) return "Trovoadas";
  return "Condição variável";
}

async function fetchWeather(location: StoredLocation): Promise<WeatherSnapshot> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(location.latitude));
  url.searchParams.set("longitude", String(location.longitude));
  url.searchParams.set(
    "current",
    "temperature_2m,apparent_temperature,weather_code,is_day",
  );
  url.searchParams.set(
    "daily",
    "temperature_2m_max,temperature_2m_min",
  );
  url.searchParams.set("temperature_unit", "celsius");
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("forecast_days", "1");

  const payload = await fetchJSON(url);
  if (!isRecord(payload) || !isRecord(payload.current) || !isRecord(payload.daily)) {
    throw new Error("Previsão inválida");
  }

  const current = payload.current;
  const daily = payload.daily;
  const weatherCode = Number(current.weather_code);
  const minimums = Array.isArray(daily.temperature_2m_min)
    ? daily.temperature_2m_min
    : [];
  const maximums = Array.isArray(daily.temperature_2m_max)
    ? daily.temperature_2m_max
    : [];

  const snapshot: WeatherSnapshot = {
    city: location.city,
    temperature: Number(current.temperature_2m),
    apparentTemperature: Number(current.apparent_temperature),
    minimum: Number(minimums[0]),
    maximum: Number(maximums[0]),
    weatherCode: Number.isFinite(weatherCode) ? weatherCode : 2,
    isDay: Number(current.is_day) === 1,
    description: describeWeatherCode(weatherCode),
    timezone:
      typeof payload.timezone === "string"
        ? payload.timezone
        : Intl.DateTimeFormat().resolvedOptions().timeZone,
    updatedAt:
      typeof current.time === "string"
        ? current.time
        : new Date().toISOString(),
    locationSource: location.source,
  };

  if (!Number.isFinite(snapshot.temperature)) {
    throw new Error("Temperatura indisponível");
  }
  return snapshot;
}

export function useLocalWeather() {
  const [weather, setWeather] = useState<WeatherSnapshot>(initialWeather);
  const [status, setStatus] = useState<WeatherStatus>("loading");
  const running = useRef(false);

  const refresh = useCallback(async (forceLocation = false) => {
    if (running.current) return;
    running.current = true;
    setStatus((current) => (current === "ready" ? current : "loading"));

    try {
      const location = await resolveLocation(forceLocation);
      const snapshot = await fetchWeather(location);
      window.localStorage.setItem(LOCATION_KEY, JSON.stringify(location));
      window.localStorage.setItem(WEATHER_KEY, JSON.stringify(snapshot));
      setWeather(snapshot);
      setStatus("ready");
    } catch {
      const cached = readStoredWeather();
      if (cached) {
        setWeather(cached);
        setStatus("stale");
      } else {
        setWeather({
          ...initialWeather,
          city: fallbackLocation.city,
          description: "Previsão indisponível",
        });
        setStatus("error");
      }
    } finally {
      running.current = false;
    }
  }, []);

  useEffect(() => {
    const cached = readStoredWeather();
    if (cached) {
      queueMicrotask(() => {
        setWeather(cached);
        setStatus("stale");
      });
    }
    queueMicrotask(() => void refresh());
    const timer = window.setInterval(() => void refresh(), REFRESH_INTERVAL);
    return () => window.clearInterval(timer);
  }, [refresh]);

  return { weather, status, refresh };
}
