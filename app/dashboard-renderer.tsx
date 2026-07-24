/* eslint-disable @next/next/no-img-element */
"use client";

import {
  CalendarDays,
  CloudSun,
  DollarSign,
  ExternalLink,
  Focus,
  ListMusic,
  Newspaper,
  Sparkles,
  Timer,
} from "lucide-react";
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import type { AgendaOccurrence, FocusSession } from "./local-widgets";
import type { PublicAnimeItem, PublicNewsItem, PublicSummary } from "./public-data";
import type { WeatherSnapshot } from "./weather";
import {
  type DashboardLayout,
  type DashboardSettings,
  type DashboardWidget,
  type MusicCache,
  readMusicCache,
} from "./dashboard-config";
import { formatTimer } from "./local-widgets";
import { themeCssVariables, useThemeForLayout } from "./theme-system";

export type DashboardRenderData = {
  now: Date;
  weather: WeatherSnapshot;
  focus: FocusSession;
  upcomingEvents: AgendaOccurrence[];
  overdueCount: number;
  summary: PublicSummary;
  music?: MusicCache;
};

function formatDate(value: string): string {
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(date);
}

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(date);
}

function formatWeekday(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long" }).format(date);
}

function safeLink(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : "";
  } catch {
    return "";
  }
}

function WidgetShell({ widget, icon, children }: { widget: DashboardWidget; icon: ReactNode; children: ReactNode }) {
  return (
    <article
      className={`dashboard-widget dashboard-widget-${widget.type} bg-${widget.background} ${widget.bordered ? "is-bordered" : "is-borderless"}`}
      style={{
        gridColumn: `span ${widget.colSpan}`,
        gridRow: `span ${widget.rowSpan}`,
        opacity: widget.opacity,
        fontSize: `${widget.fontScale}em`,
      }}
      data-widget-id={widget.id}
    >
      {widget.showHeader && <header><span>{icon}</span><strong>{widget.title}</strong></header>}
      <div className="dashboard-widget-body">{children}</div>
    </article>
  );
}

function NewsWidget({
  widget,
  items,
  settings,
  label,
  icon,
  secondary,
}: {
  widget: DashboardWidget;
  items: PublicNewsItem[];
  settings: DashboardSettings;
  label: string;
  icon: ReactNode;
  secondary?: PublicAnimeItem[];
}) {
  const [index, setIndex] = useState(0);
  const filtered = useMemo(() => {
    if (settings.newsSource === "all" || widget.type === "anime") return items;
    return items.filter((item) => {
      const source = item.source.toLocaleLowerCase("pt-BR");
      return settings.newsSource === "hacker-news"
        ? source.includes("hacker") || item.id.startsWith("hn-")
        : source.includes("dev") || item.id.startsWith("dev-");
    });
  }, [items, settings.newsSource, widget.type]);
  const current = filtered[index % Math.max(1, filtered.length)] ?? null;

  useEffect(() => {
    if (filtered.length <= 1) return;
    const timer = window.setInterval(() => setIndex((value) => (value + 1) % filtered.length), settings.newsCarouselSeconds * 1000);
    return () => window.clearInterval(timer);
  }, [filtered.length, settings.newsCarouselSeconds]);

  return (
    <WidgetShell widget={widget} icon={icon}>
      {!current ? <p className="dashboard-empty">{label} indisponíveis.</p> : (
        <div className={`dashboard-news ${settings.newsImageOnly ? "image-only" : ""}`}>
          {current.imageUrl && <img src={current.imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer" />}
          {!settings.newsImageOnly && <div>
            <strong>{current.title}</strong>
            <span>{current.source} · {index + 1}/{filtered.length}</span>
            {safeLink(current.url) && <a href={current.url} target="_blank" rel="noreferrer">Abrir <ExternalLink /></a>}
          </div>}
        </div>
      )}
      {secondary && secondary.length > 0 && (
        <div className="dashboard-anime-strip">
          {secondary.slice(0, 3).map((item) => <a key={item.id} href={item.url} target="_blank" rel="noreferrer">{item.title}</a>)}
        </div>
      )}
    </WidgetShell>
  );
}

function DashboardWidgetView({ widget, data, settings }: { widget: DashboardWidget; data: DashboardRenderData; settings: DashboardSettings }) {
  if (widget.type === "clock") {
    return <WidgetShell widget={widget} icon={<Timer />}><div className="dashboard-clock"><strong>{formatTime(data.now)}</strong><span>{formatWeekday(data.now)}</span></div></WidgetShell>;
  }
  if (widget.type === "agenda") {
    return <WidgetShell widget={widget} icon={<CalendarDays />}><div className="dashboard-agenda-summary">
      {data.overdueCount > 0 && <span className="dashboard-alert">{data.overdueCount} tarefa(s) atrasada(s)</span>}
      {data.upcomingEvents.slice(0, 5).map((event) => <div key={`${event.id}-${event.occurrenceDate}`}><time>{formatDate(event.occurrenceDate)} · {event.time}</time><strong>{event.title}</strong><small>{event.category || (event.kind === "task" ? "Tarefa" : "Lembrete")}</small></div>)}
      {data.upcomingEvents.length === 0 && <p className="dashboard-empty">Agenda livre.</p>}
    </div></WidgetShell>;
  }
  if (widget.type === "weather") {
    return <WidgetShell widget={widget} icon={<CloudSun />}><div className="dashboard-weather"><strong>{data.weather.temperature === null ? "—" : `${Math.round(data.weather.temperature)}°`}</strong><span>{data.weather.description}</span><small>{data.weather.city} · {data.weather.minimum === null ? "—" : Math.round(data.weather.minimum)}° / {data.weather.maximum === null ? "—" : Math.round(data.weather.maximum)}°</small></div></WidgetShell>;
  }
  if (widget.type === "focus") {
    return <WidgetShell widget={widget} icon={<Focus />}><div className="dashboard-focus"><strong>{formatTimer(data.focus.remainingSeconds)}</strong><span>{data.focus.project}</span><small>{data.focus.task}</small></div></WidgetShell>;
  }
  if (widget.type === "news") {
    return <NewsWidget widget={widget} items={data.summary.news} settings={settings} label="Notícias" icon={<Newspaper />} />;
  }
  if (widget.type === "anime") {
    return <NewsWidget widget={widget} items={data.summary.anime.news} settings={settings} label="Notícias de anime" icon={<Sparkles />} secondary={data.summary.anime.trending} />;
  }
  if (widget.type === "economy") {
    return <WidgetShell widget={widget} icon={<DollarSign />}><div className="dashboard-economy"><strong>US$ {data.summary.rates.usdBrl?.toFixed(2) ?? "—"}</strong><span>Selic {data.summary.economy.selicAnnual?.toFixed(2) ?? "—"}%</span><small>IPCA {data.summary.economy.ipcaMonthly?.toFixed(2) ?? "—"}% · EUR {data.summary.rates.eurBrl?.toFixed(2) ?? "—"}</small></div></WidgetShell>;
  }
  const music = data.music ?? readMusicCache();
  return <WidgetShell widget={widget} icon={<ListMusic />}><div className="dashboard-music">
    <span>Gênero: {music.genre || "não escolhido"}</span>
    {music.tracks.slice(0, 3).map((track) => <a key={track.id} href={track.spotifySearchUrl || track.storeUrl} target="_blank" rel="noreferrer"><strong>{track.title}</strong><small>{track.artist}</small></a>)}
    {music.tracks.length === 0 && <p className="dashboard-empty">Escolha um gênero na área Música.</p>}
  </div></WidgetShell>;
}

export function DashboardRenderer({
  layout,
  settings,
  data,
  className = "",
}: {
  layout: DashboardLayout;
  settings: DashboardSettings;
  data: DashboardRenderData;
  className?: string;
}) {
  const layoutTheme = useThemeForLayout(layout.id);
  return (
    <section
      className={`dashboard-renderer renderer-bg-${layout.background} ${className}`}
      style={{ ...themeCssVariables(layoutTheme), gridTemplateColumns: `repeat(${layout.columns}, minmax(0, 1fr))`, gap: layout.gap } as CSSProperties}
      aria-label={layout.name}
    >
      {layout.widgets.filter((widget) => widget.enabled).map((widget) => (
        <DashboardWidgetView key={widget.id} widget={widget} data={data} settings={settings} />
      ))}
    </section>
  );
}
