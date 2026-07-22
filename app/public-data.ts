"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isRecord, readStoredValue, writeStoredValue } from "./storage";

const PUBLIC_DATA_KEY = "lumaboard-public-data-v1";
const DEFAULT_REFRESH_MINUTES = 15;
const REFRESH_SETTINGS_KEY = "lumaboard-refresh-minutes";

export type PublicNewsItem = {
  id: number;
  title: string;
  url: string;
  score: number;
  source: string;
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
  warnings: string[];
};

type PublicDataStatus = "loading" | "ready" | "stale" | "error";

export const initialPublicSummary: PublicSummary = {
  updatedAt: "",
  sources: ["Open-Meteo", "Frankfurter", "BrasilAPI", "Hacker News"],
  news: [],
  rates: { date: null, usdBrl: null, eurBrl: null },
  nextHoliday: null,
  airQuality: { europeanAqi: null, pm25: null, updatedAt: null },
  warnings: [],
};

function nullableNumber(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isFinite(value));
}

function isPublicSummary(value: unknown): value is PublicSummary {
  if (!isRecord(value)) return false;
  if (typeof value.updatedAt !== "string") return false;
  if (!Array.isArray(value.sources) || !Array.isArray(value.news)) return false;
  if (!isRecord(value.rates) || !isRecord(value.airQuality)) return false;
  return (
    nullableNumber(value.rates.usdBrl) &&
    nullableNumber(value.rates.eurBrl) &&
    nullableNumber(value.airQuality.europeanAqi) &&
    nullableNumber(value.airQuality.pm25)
  );
}

async function fetchSummary(latitude: number, longitude: number) {
  const url = new URL("/api/public/summary", window.location.origin);
  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    url.searchParams.set("lat", String(latitude));
    url.searchParams.set("lon", String(longitude));
  }
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 12000);
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

export function usePublicSummary(latitude: number, longitude: number) {
  const [summary, setSummary] = useState<PublicSummary>(initialPublicSummary);
  const [status, setStatus] = useState<PublicDataStatus>("loading");
  const [refreshMinutes, setRefreshMinutes] = useState(DEFAULT_REFRESH_MINUTES);
  const running = useRef(false);

  const refresh = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    setStatus((current) => (current === "ready" ? current : "loading"));
    try {
      const payload = await fetchSummary(latitude, longitude);
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
  }, [latitude, longitude]);

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
