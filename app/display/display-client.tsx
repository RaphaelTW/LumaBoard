"use client";

import { ChevronLeft, ChevronRight, Expand, Pause, Play, RefreshCw, Wifi, WifiOff, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  decodeDashboardState,
  readDashboardState,
  readMusicCache,
  resolveScheduledLayout,
  type DashboardState,
} from "../dashboard-config";
import { DashboardRenderer } from "../dashboard-renderer";
import { useLocalWidgets } from "../local-widgets";
import { usePublicSummary } from "../public-data";
import { useLocalWeather } from "../weather";

export function DisplayClient() {
  const [state, setState] = useState<DashboardState | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [online, setOnline] = useState(true);
  const [pausedUntil, setPausedUntil] = useState(0);
  const [forcedLayoutId, setForcedLayoutId] = useState<string | null>(null);
  const [cursorVisible, setCursorVisible] = useState(true);
  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null);
  const localWidgets = useLocalWidgets();
  const { weather, status: weatherStatus, refresh: refreshWeather } = useLocalWeather();
  const { summary, status: publicStatus, refresh: refreshPublic } = usePublicSummary(weather.latitude, weather.longitude, weather.city, weather.stateCode, weather.timezone);

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const shared = hash.get("config");
    const initial = shared ? decodeDashboardState(shared) : null;
    queueMicrotask(() => {
      setState(initial ?? readDashboardState());
      setOnline(navigator.onLine);
    });
    const sync = (event: Event) => {
      if (event instanceof CustomEvent) setState(event.detail as DashboardState);
      else setState(readDashboardState());
    };
    window.addEventListener("lumaboard:dashboard", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("lumaboard:dashboard", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const updateOnline = () => {
      const nextOnline = navigator.onLine;
      setOnline(nextOnline);
      if (nextOnline) void Promise.all([refreshWeather(true), refreshPublic()]);
    };
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    return () => {
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
    };
  }, [refreshPublic, refreshWeather]);

  useEffect(() => {
    if (!state?.settings.preventSleep || !("wakeLock" in navigator)) return;
    const request = async () => {
      try {
        const wakeLock = (navigator as Navigator & { wakeLock: { request: (type: "screen") => Promise<{ release: () => Promise<void> }> } }).wakeLock;
        wakeLockRef.current = await wakeLock.request("screen");
      } catch {
        wakeLockRef.current = null;
      }
    };
    void request();
    const onVisibility = () => { if (document.visibilityState === "visible") void request(); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      void wakeLockRef.current?.release();
      wakeLockRef.current = null;
    };
  }, [state?.settings.preventSleep]);

  useEffect(() => {
    if (!state?.settings.hideCursor) return;
    let timer = window.setTimeout(() => setCursorVisible(false), 2500);
    const show = () => {
      setCursorVisible(true);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setCursorVisible(false), 2500);
    };
    window.addEventListener("pointermove", show);
    return () => {
      window.removeEventListener("pointermove", show);
      window.clearTimeout(timer);
    };
  }, [state?.settings.hideCursor]);

  const pauseByInteraction = useCallback(() => {
    if (!state?.settings.pauseOnInteraction) return;
    setPausedUntil(Date.now() + state.settings.pauseSeconds * 1000);
    const current = resolveScheduledLayout(state, now, forcedLayoutId);
    setForcedLayoutId(current.id);
  }, [forcedLayoutId, now, state]);

  useEffect(() => {
    const interact = () => pauseByInteraction();
    window.addEventListener("pointerdown", interact);
    window.addEventListener("keydown", interact);
    return () => {
      window.removeEventListener("pointerdown", interact);
      window.removeEventListener("keydown", interact);
    };
  }, [pauseByInteraction]);

  useEffect(() => {
    if (pausedUntil > 0 && Date.now() >= pausedUntil) {
      queueMicrotask(() => { setPausedUntil(0); setForcedLayoutId(null); });
    }
  }, [now, pausedUntil]);

  const moveLayout = (direction: -1 | 1) => {
    if (!state) return;
    const current = resolveScheduledLayout(state, now, forcedLayoutId);
    const index = state.layouts.findIndex((layout) => layout.id === current.id);
    const next = state.layouts[(index + direction + state.layouts.length) % state.layouts.length];
    setForcedLayoutId(next.id);
    setPausedUntil(Date.now() + Math.max(60, state.settings.pauseSeconds) * 1000);
  };

  const refreshAll = () => void Promise.all([refreshWeather(true), refreshPublic()]);
  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      // Fullscreen is optional and may be blocked by the browser.
    }
  };

  const layout = state ? resolveScheduledLayout(state, now, forcedLayoutId) : null;
  const renderData = useMemo(() => ({
    now,
    weather,
    focus: localWidgets.focus,
    upcomingEvents: localWidgets.upcomingEvents,
    overdueCount: localWidgets.overdueTasks.length,
    summary,
    music: readMusicCache(),
  }), [now, weather, localWidgets.focus, localWidgets.upcomingEvents, localWidgets.overdueTasks.length, summary]);

  if (!state || !layout) return <main className="standalone-display loading"><RefreshCw className="spin" /> Carregando display…</main>;

  return (
    <main
      className={`standalone-display transition-${state.settings.transition} ${cursorVisible || !state.settings.hideCursor ? "cursor-visible" : "cursor-hidden"}`}
      style={{ "--display-transition": `${state.settings.transitionSeconds}s` } as CSSProperties}
      onDoubleClick={() => void toggleFullscreen()}
    >
      <DashboardRenderer key={layout.id} layout={layout} settings={state.settings} data={renderData} className="standalone-dashboard" />
      <div className="display-controls-v2">
        <button onClick={() => moveLayout(-1)} aria-label="Tela anterior"><ChevronLeft /></button>
        <button onClick={() => { if (pausedUntil) { setPausedUntil(0); setForcedLayoutId(null); } else { setForcedLayoutId(layout.id); setPausedUntil(Date.now() + state.settings.pauseSeconds * 1000); } }} aria-label={pausedUntil ? "Retomar programação" : "Pausar programação"}>{pausedUntil ? <Play /> : <Pause />}</button>
        <button onClick={() => moveLayout(1)} aria-label="Próxima tela"><ChevronRight /></button>
        <button onClick={refreshAll} aria-label="Atualizar dados"><RefreshCw /></button>
        <button onClick={() => void toggleFullscreen()} aria-label="Tela cheia"><Expand /></button>
        <a href="/" aria-label="Sair do display"><X /></a>
      </div>
      {state.settings.showStatus && <footer className="display-status-v2"><span>{online ? <Wifi /> : <WifiOff />} {online ? "online" : "offline · usando cache"}</span><strong>{layout.name}</strong><span>{weatherStatus} · {publicStatus} · {pausedUntil ? "programação pausada" : "programação automática"}</span></footer>}
    </main>
  );
}
