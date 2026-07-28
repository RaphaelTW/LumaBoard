"use client";

import { useEffect, useState } from "react";
import { readDashboardState, readMusicCache, type DashboardState } from "./dashboard-config";

export function useDashboardSync() {
  const [dashboardState, setDashboardState] = useState<DashboardState | null>(null);
  const [musicCache, setMusicCache] = useState(() => readMusicCache());

  useEffect(() => {
    queueMicrotask(() => {
      setDashboardState(readDashboardState());
      setMusicCache(readMusicCache());
    });
  }, []);

  useEffect(() => {
    const syncDashboard = (event: Event) => {
      if (event instanceof CustomEvent && event.detail) setDashboardState(event.detail as DashboardState);
      else setDashboardState(readDashboardState());
    };
    const syncMusic = (event: Event) => {
      if (event instanceof CustomEvent && event.detail) setMusicCache(event.detail);
      else setMusicCache(readMusicCache());
    };
    window.addEventListener("lumaboard:dashboard", syncDashboard);
    window.addEventListener("lumaboard:music", syncMusic);
    window.addEventListener("storage", syncDashboard);
    window.addEventListener("storage", syncMusic);
    return () => {
      window.removeEventListener("lumaboard:dashboard", syncDashboard);
      window.removeEventListener("lumaboard:music", syncMusic);
      window.removeEventListener("storage", syncDashboard);
      window.removeEventListener("storage", syncMusic);
    };
  }, []);

  return { dashboardState, musicCache };
}
